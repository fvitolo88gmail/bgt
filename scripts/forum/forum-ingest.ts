// Fase 3/3 dell'ingest forum: storage grezzo + embedding radice.
// Approccio small-to-big: ogni post viene salvato per intero in
// forum_posts (nessun embedding, solo storage), ma solo la radice di ogni
// thread viene embeddata e inserita in chunks — è l'unica unità cercabile
// via similarità. Il resto del thread viene recuperato a runtime,
// espandendo per bgg_thread_id quando la radice vince il retrieval.
//
// Idempotente su entrambe le tabelle. Retry con backoff sul 429 di quota
// embedding (limite osservato: 100 richieste/minuto su Gemini Embedding 1,
// non documentato altrove — verificato via dashboard).
//
// Legge da ingest/{game-slug}/forum/posts.json.
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum/forum-ingest.ts \
//     --game-slug <slug> --game-id {uuid}

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServiceClient } from '../../lib/supabase';
import { geminiClient } from '../../lib/gemini';
import { verifyGameIdentity } from '../../lib/games';

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

const SELECT_PAGE_SIZE = 1000; // limite di default PostgREST per richiesta senza .range()

/**
 * Legge tutti gli `bgg_article_id` già presenti in `table` per un gioco
 * (opzionalmente filtrati su `source`), paginando esplicitamente.
 *
 * Senza paginazione, una singola `.select()` si ferma al limite di default
 * di PostgREST (SELECT_PAGE_SIZE righe): su un gioco con più post di quel
 * limite, il set di "già presenti" risultava incompleto — righe realmente
 * già in DB venivano considerate nuove, il successivo insert falliva con
 * "duplicate key" (osservato su Hegemony, ~841 thread).
 */
async function fetchExistingArticleIds(
    supabase: ReturnType<typeof createServiceClient>,
    table: 'forum_posts' | 'chunks',
    gameId: string,
    source?: 'forum'
): Promise<Set<number>> {
    const ids = new Set<number>();
    let from = 0;

    while (true) {
        let query = supabase
            .from(table)
            .select('bgg_article_id')
            .eq('game_id', gameId)
            .range(from, from + SELECT_PAGE_SIZE - 1);
        if (source) query = query.eq('source', source);

        const { data, error } = await query;
        if (error) {
            throw new Error(`Errore leggendo ${table} esistenti: ${error.message}`);
        }

        for (const row of data ?? []) {
            ids.add(row.bgg_article_id as number);
        }

        if (!data || data.length < SELECT_PAGE_SIZE) break;
        from += SELECT_PAGE_SIZE;
        console.log(`[ingest]   ${table}: letti ${ids.size} id finora...`);
    }

    return ids;
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

/**
 * Fase 3/3: storage grezzo + embedding radice, a partire da posts.json.
 * Idempotente su entrambe le tabelle (v. commento in testa al file).
 * Estratta come funzione esportata così `sync-forum.ts` può richiamarla
 * dopo un fetch incrementale senza duplicare la logica di storage/embedding.
 */
export async function ingestForumPosts(gameSlug: string, gameId: string): Promise<void> {
    const inPath = `ingest/${gameSlug}/forum/posts.json`;

    if (!existsSync(inPath)) {
        throw new Error(`${inPath} non trovato — lancia prima forum-discover.ts e forum-fetch.ts`);
    }

    const input = JSON.parse(await readFile(inPath, 'utf-8')) as FetchInput;
    const supabase = createServiceClient();

    // --game-slug e --game-id sono flag indipendenti: verifica che puntino
    // allo stesso gioco PRIMA di scrivere, altrimenti si rischia di taggare
    // il forum di un gioco con il game_id di un altro (corruzione silenziosa).
    await verifyGameIdentity(supabase, gameId, input.bggId);

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
    const alreadyStoredRaw = await fetchExistingArticleIds(supabase, 'forum_posts', gameId);
    console.log(`[ingest] ${alreadyStoredRaw.size} post già presenti in forum_posts, ${input.threads.length} thread da scansionare`);

    let rawSaved = 0;
    let rawErrori = 0;

    for (const [threadIndex, thread] of input.threads.entries()) {
        if (threadIndex > 0 && threadIndex % 200 === 0) {
            console.log(`[ingest]   forum_posts: ${threadIndex}/${input.threads.length} thread scansionati (${rawSaved} post salvati finora)`);
        }
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
    const alreadyIngested = await fetchExistingArticleIds(supabase, 'chunks', gameId, 'forum');
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

async function main(): Promise<void> {
    const { gameSlug, gameId } = parseArgs();
    await ingestForumPosts(gameSlug, gameId);
}

if (require.main === module) {
    main().catch((error) => {
        console.error('[ingest] fallito:', error);
        process.exitCode = 1;
    });
}