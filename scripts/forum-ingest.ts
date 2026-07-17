// scripts/forum-ingest.ts
//
// Fase 3/3 dell'ingest forum (D27): embedding + insert Supabase dei post
// prodotti da forum-fetch.ts, con match designer (case-insensitive esatto,
// nessun fuzzy — rischio noto: falsi negativi, zero falsi positivi).
//
// Idempotente: interroga i bgg_article_id già presenti per questo gioco e
// salta quelli, quindi un rilancio dopo un errore parziale non duplica nulla
// (in aggiunta al vincolo unique su chunks.bgg_article_id already esistente
// come ultima rete di sicurezza).
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum-ingest.ts \
//     --in forum-data/224517/posts.json --game-id {uuid}

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createServiceClient } from '../lib/supabase';
import { geminiClient } from '../lib/gemini';

interface FetchedPost {
    postId: number;
    authorUsername: string;
    postDate: string;
    bodyClean: string;
}

interface FetchedThread {
    threadId: number;
    subject: string;
    replyCount: number;
    posts: FetchedPost[];
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

function parseArgs(): { in: string; gameId: string } {
    const args = process.argv.slice(2);
    const inPath = getFlag(args, '--in');
    const gameId = getFlag(args, '--game-id');
    if (!inPath || !gameId) {
        throw new Error('Uso: --in <posts.json> --game-id <uuid>');
    }
    return { in: inPath, gameId };
}

function isDesignerResponse(authorUsername: string, designers: string[]): boolean {
    const normalizedAuthor = authorUsername.trim().toLowerCase();
    return designers.some((name) => name.trim().toLowerCase() === normalizedAuthor);
}

function buildContent(threadSubject: string, post: FetchedPost): string {
    return `[Thread: ${threadSubject}]\n[Autore: ${post.authorUsername}]\n[Data: ${post.postDate}]\n${post.bodyClean}`;
}

async function main(): Promise<void> {
    const { in: inPath, gameId } = parseArgs();
    const input = JSON.parse(await readFile(inPath, 'utf-8')) as FetchInput;
    const supabase = createServiceClient();

    console.log(
        `[ingest] gioco: ${input.gameName} (bggId=${input.bggId}), designer accreditati: ${input.designers.join(', ') || 'nessuno'}`
    );

    // Idempotenza: recupero i bgg_article_id già presenti per questo gioco,
    // così un rilancio dopo un errore parziale non rifà l'embedding di post
    // già salvati (l'embedding è la parte costosa/quota-limitata di questa fase).
    const { data: existingRows, error: existingError } = await supabase
        .from('chunks')
        .select('bgg_article_id')
        .eq('game_id', gameId)
        .eq('source', 'forum');

    if (existingError) {
        throw new Error(`Errore leggendo chunk esistenti: ${existingError.message}`);
    }

    const alreadyIngested = new Set(
        (existingRows ?? []).map((row) => row.bgg_article_id as number)
    );
    console.log(`[ingest] ${alreadyIngested.size} post già presenti in DB, verranno saltati`);

    const modelVersion = process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001';

    let saved = 0;
    let skipped = 0;
    let errori = 0;

    for (const thread of input.threads) {
        for (const post of thread.posts) {
            if (alreadyIngested.has(post.postId)) {
                skipped += 1;
                continue;
            }

            try {
                const content = buildContent(thread.subject, post);
                const embedding = await geminiClient.embed(content);
                const designerFlag = isDesignerResponse(post.authorUsername, input.designers);

                const { error: insertError } = await supabase.from('chunks').insert({
                    game_id: gameId,
                    source: 'forum',
                    content,
                    embedding,
                    model_version: modelVersion,
                    bgg_thread_id: thread.threadId,
                    bgg_article_id: post.postId,
                    thread_subject: thread.subject,
                    author_username: post.authorUsername,
                    is_designer_response: designerFlag,
                    post_date: post.postDate,
                });

                if (insertError) {
                    // Copre anche il caso limite di una corsa tra la lettura
                    // di alreadyIngested e questo insert (rilanci concorrenti):
                    // il vincolo unique su bgg_article_id fa comunque da rete
                    // di sicurezza, qui logghiamo e andiamo avanti.
                    throw new Error(insertError.message);
                }

                saved += 1;
                if (saved % 25 === 0) {
                    console.log(`[ingest] ${saved} post salvati finora...`);
                }

                saved += 1;
                if (saved % 25 === 0) {
                    console.log(`[ingest] ${saved} post salvati finora...`);
                }

                // pausa per evitare rate limit Gemini, stesso pattern di ingest-pdf.ts
                await new Promise((res) => setTimeout(res, 200));
            } catch (error) {
                errori += 1;
                console.error(`[ingest] errore su post ${post.postId} (thread ${thread.threadId}):`, error);
            }
        }
    }

    console.log(`[ingest] chunk: ${saved} salvati, ${skipped} già presenti, ${errori} errori`);

    // Metadati thread — upsert su bgg_thread_id (unique), stesso pattern
    // "salvo comunque anche con errori parziali sui chunk" di ingest-pdf.ts:
    // il conteggio saved/errori sopra resta la fonte di verità, non i flag.
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

    if (threadsError) {
        console.error('[ingest] errore aggiornando forum_threads:', threadsError.message);
    } else {
        console.log(`[ingest] forum_threads aggiornato (${threadRows.length} thread)`);
    }

    const { error: gameError } = await supabase
        .from('games')
        .update({ forum_ready: true, last_forum_sync: new Date().toISOString() })
        .eq('id', gameId);

    if (gameError) {
        console.error('[ingest] errore aggiornando games.forum_ready:', gameError.message);
    } else {
        console.log('[ingest] games.forum_ready = true');
    }

    if (errori > 0) {
        console.log('[ingest] rilancia lo stesso comando per ritentare i post falliti');
    }
}

main().catch((error) => {
    console.error('[ingest] fallito:', error);
    process.exitCode = 1;
});