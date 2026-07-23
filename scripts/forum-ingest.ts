// scripts/forum-ingest.ts
//
// Fase 3/3 dell'ingest forum (D27): storage grezzo + embedding radice.
// Approccio small-to-big (sessione ingest forum): ogni post viene salvato
// per intero in forum_posts (nessun embedding, solo storage), ma SOLO la
// radice di ogni thread viene embeddata e inserita in chunks — è l'unica
// unità cercabile via similarità. Il resto del thread viene recuperato a
// runtime (F5) espandendo per bgg_thread_id quando la radice vince il
// retrieval.
//
// Idempotente su entrambe le tabelle. Retry con backoff sul 429 di quota
// embedding (limite osservato: 100 richieste/minuto su Gemini Embedding 1,
// non documentato altrove — verificato via dashboard in sessione).
//
// Legge da ingest/{game-slug}/forum/posts.json (alberatura D28).
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum-ingest.ts \
//     --game-slug brass --game-id {uuid}

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServiceClient } from '../lib/supabase';
import { geminiClient } from '../lib/gemini';

const EMBED_PAUSE_MS = 800; // ~75 req/min, sotto il tetto reale di 100/min (verificato via dashboard)

interface FetchedPost {
    postId: number;
    authorUsername: string;
    postDate: string;
    bodyClean: string;
    quotedAuthor: string | null;
}

interface FetchedThread {
    threadId: number;
    subject: string;
    replyCount: number;
    posts: FetchedPost[]; // ordine cronologico
}

interface FetchInput {
    bggId: number;
    gameName: string;
    designers: string[];
    threads: FetchedThread[];
}

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(): { gameSlug: string; gameId: string } {
    const args = process.argv.slice(2);
    const gameSlug = getFlag(args, '--game-slug');
    const gameId = getFlag(args, '--game-id');
    if (!gameSlug || !gameId) {
        throw new Error('Uso: --game-slug <slug> --game-id <uuid>');
    }
    return { gameSlug, gameId };
}

function isDesignerResponse(authorUsername: string, designers: string[]): boolean {
    const normalizedAuthor = authorUsername.trim().toLowerCase();
    return designers.some((name) => name.trim().toLowerCase() === normalizedAuthor);
}

async function embedWithRetry(content: string, maxRetries = 3): Promise<number[]> {
    let attempt = 0;
    while (true) {
        try {
            return await geminiClient.embed(content);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isQuotaError = message.includes('RESOURCE_EXHAUSTED') || message.includes('429');
            if (!isQuotaError || attempt >= maxRetries) throw error;

            attempt += 1;
            const retryMatch = message.match(/retryDelay":"(\d+)s/);
            const waitSeconds = retryMatch ? Number(retryMatch[1]) : 60;
            console.log(
                `[ingest] quota embedding esaurita, attesa ${waitSeconds + 2}s (tentativo ${attempt}/${maxRetries})...`
            );
            await new Promise((res) => setTimeout(res, (waitSeconds + 2) * 1000));
        }
    }
}

async function main(): Promise<void> {
    const { gameSlug, gameId } = parseArgs();
    const inPath = `ingest/${gameSlug}/forum/posts.json`;

    if (!existsSync(inPath)) {
        throw new Error(`${inPath} non trovato — lancia prima forum-discover.ts e forum-fetch.ts`);
    }

    const input = JSON.parse(await readFile(inPath, 'utf-8')) as FetchInput;
    const supabase = createServiceClient();

    console.log(
        `[ingest] gioco: ${input.gameName} (bggId=${input.bggId}), designer accreditati: ${input.designers.join(', ') || 'nessuno'}`
    );

    const threadRows = input.threads.map((thread) => ({
        game_id: gameId,
        bgg_thread_id: thread.threadId,
        subject: thread.subject,
        reply_count: thread.replyCount,
        fetched_at: new Date().toISOString(),
    }));

    const { error: threadsError } = await supabase
        .from('forum_threads')
        .upsert(threadRows, { onConflict: 'bgg_thread_id' });

    if (threadsError) console.error('[ingest] errore aggiornando forum_threads:', threadsError.message);
    else console.log(`[ingest] forum_threads aggiornato (${threadRows.length} thread)`);

    // --- forum_posts: TUTTI i post, nessun embedding, solo storage grezzo ---
    const { data: existingRawRows } = await supabase
        .from('forum_posts')
        .select('bgg_article_id')
        .eq('game_id', gameId);
    const alreadyStoredRaw = new Set((existingRawRows ?? []).map((r) => r.bgg_article_id as number));

    let rawSaved = 0;
    let rawErrori = 0;

    for (const thread of input.threads) {
        const rows = thread.posts
            .filter((p) => !alreadyStoredRaw.has(p.postId))
            .map((p) => ({
                game_id: gameId,
                bgg_thread_id: thread.threadId,
                bgg_article_id: p.postId,
                author_username: p.authorUsername,
                quoted_author: p.quotedAuthor,
                post_date: p.postDate,
                body_clean: p.bodyClean,
                is_designer_response: isDesignerResponse(p.authorUsername, input.designers),
            }));

        if (rows.length === 0) continue;

        const { error } = await supabase.from('forum_posts').insert(rows);
        if (error) {
            rawErrori += rows.length;
            console.error(`[ingest] errore salvando post grezzi thread ${thread.threadId}:`, error.message);
        } else {
            rawSaved += rows.length;
        }
    }
    console.log(`[ingest] forum_posts: ${rawSaved} post salvati, ${rawErrori} errori`);

    // --- chunks: SOLO la radice di ogni thread, embeddata e cercabile ---
    const { data: existingChunkRows, error: existingError } = await supabase
        .from('chunks')
        .select('bgg_article_id')
        .eq('game_id', gameId)
        .eq('source', 'forum');

    if (existingError) {
        throw new Error(`Errore leggendo chunk esistenti: ${existingError.message}`);
    }

    const alreadyIngested = new Set(
        (existingChunkRows ?? []).map((row) => row.bgg_article_id as number)
    );
    console.log(`[ingest] ${alreadyIngested.size} radici già presenti in chunks, verranno saltate`);

    const modelVersion = process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001';
    let saved = 0;
    let skipped = 0;
    let errori = 0;

    for (const thread of input.threads) {
        const root = thread.posts[0];
        if (!root) continue;

        if (alreadyIngested.has(root.postId)) {
            skipped += 1;
            continue;
        }

        try {
            const content = `[Thread: ${thread.subject}]\n[Autore: ${root.authorUsername}]\n[Data: ${root.postDate}]\n${root.bodyClean}`;
            const embedding = await embedWithRetry(content);
            const designerFlag = isDesignerResponse(root.authorUsername, input.designers);

            const { error: insertError } = await supabase.from('chunks').insert({
                game_id: gameId,
                source: 'forum',
                content,
                embedding,
                model_version: modelVersion,
                bgg_thread_id: thread.threadId,
                bgg_article_id: root.postId,
                thread_subject: thread.subject,
                author_username: root.authorUsername,
                is_designer_response: designerFlag,
                post_date: root.postDate,
            });

            if (insertError) throw new Error(insertError.message);

            saved += 1;
            if (saved % 25 === 0) console.log(`[ingest] ${saved} radici salvate finora...`);

            await new Promise((res) => setTimeout(res, EMBED_PAUSE_MS));
        } catch (error) {
            errori += 1;
            console.error(`[ingest] errore su radice thread ${thread.threadId}:`, error);
        }
    }

    console.log(`[ingest] chunks (radici): ${saved} salvate, ${skipped} già presenti, ${errori} errori`);

    const { error: gameError } = await supabase
        .from('games')
        .update({ forum_ready: true, last_forum_sync: new Date().toISOString() })
        .eq('id', gameId);

    if (gameError) console.error('[ingest] errore aggiornando games.forum_ready:', gameError.message);
    else console.log('[ingest] games.forum_ready = true');

    if (errori > 0 || rawErrori > 0) {
        console.log('[ingest] rilancia lo stesso comando per ritentare le parti fallite');
    }
}

main().catch((error) => {
    console.error('[ingest] fallito:', error);
    process.exitCode = 1;
});