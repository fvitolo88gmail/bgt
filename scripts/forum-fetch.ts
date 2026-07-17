// scripts/forum-fetch.ts
//
// Fase 2/3 dell'ingest forum (D27): scarica i post di ogni thread trovato
// da forum-discover.ts, li pulisce (lib/bgg-clean.ts) e li filtra per
// lunghezza minima (D10, >50 caratteri sul testo GIÀ pulito, non sul body
// grezzo — altrimenti markup HTML/quote gonfia artificialmente la lunghezza).
//
// RESUMABILE: se --out esiste già, i thread già presenti vengono saltati.
// Scrive su disco dopo OGNI thread, non solo alla fine — un crash o un
// Ctrl+C a metà non fa perdere il lavoro già fatto.
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum-fetch.ts \
//     --in forum-data/224517/discover.json --out forum-data/224517/posts.json

import 'dotenv/config';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {existsSync} from 'node:fs';
import {getThread} from '../lib/bgg';
import {cleanForumBody} from '../lib/bgg-clean';

const MIN_BODY_LENGTH = 50;

interface DiscoverInput {
    bggId: number;
    gameName: string;
    designers: string[];
    threads: { threadId: number; subject: string; replyCount: number; postDate: string }[];
}

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

interface FetchOutput {
    bggId: number;
    gameName: string;
    designers: string[];
    threads: FetchedThread[];
}

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(): { in: string; out: string } {
    const args = process.argv.slice(2);
    const inPath = getFlag(args, '--in');
    const outPath = getFlag(args, '--out');
    if (!inPath || !outPath) {
        throw new Error('Uso: --in <discover.json> --out <posts.json>');
    }
    return {in: inPath, out: outPath};
}

async function loadExistingOutput(
    outPath: string,
    fallback: Pick<FetchOutput, 'bggId' | 'gameName' | 'designers'>
): Promise<FetchOutput> {
    if (!existsSync(outPath)) {
        return {...fallback, threads: []};
    }
    const raw = await readFile(outPath, 'utf-8');
    return JSON.parse(raw) as FetchOutput;
}

async function main(): Promise<void> {
    const {in: inPath, out: outPath} = parseArgs();

    const discover = JSON.parse(await readFile(inPath, 'utf-8')) as DiscoverInput;
    const output = await loadExistingOutput(outPath, {
        bggId: discover.bggId,
        gameName: discover.gameName,
        designers: discover.designers,
    });

    const alreadyFetched = new Set(output.threads.map((t) => t.threadId));
    const pending = discover.threads.filter((t) => !alreadyFetched.has(t.threadId));

    console.log(`[fetch] ${alreadyFetched.size} thread già scaricati, ${pending.length} da fare`);

    await mkdir(dirname(outPath), {recursive: true});

    let done = 0;
    let errori = 0;
    for (const thread of pending) {
        try {
            const detail = await getThread(thread.threadId);

            const posts: FetchedPost[] = [];
            for (const post of detail.posts) {
                const bodyClean = cleanForumBody(post.body);
                if (bodyClean.length > MIN_BODY_LENGTH) {
                    posts.push({
                        postId: post.postId,
                        authorUsername: post.authorUsername,
                        postDate: post.postDate,
                        bodyClean,
                    });
                }
            }

            output.threads.push({
                threadId: thread.threadId,
                subject: thread.subject,
                replyCount: thread.replyCount,
                posts
            });
            await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');

            done += 1;
            console.log(
                `[fetch] ${done}/${pending.length} — thread ${thread.threadId} (${posts.length}/${detail.posts.length} post sopra soglia)`
            );
        } catch (error) {
            errori += 1;
            console.error(`[fetch] errore su thread ${thread.threadId}:`, error);
            // Non interrompe la run: il thread non è stato aggiunto a
            // output.threads, quindi un rilancio dello stesso comando lo
            // ritenta automaticamente.
        }
    }

    console.log(`[fetch] completato: ${done} ok, ${errori} errori`);
    if (errori > 0) {
        console.log('[fetch] rilancia lo stesso comando per ritentare i thread falliti');
    }
}

main().catch((error) => {
    console.error('[fetch] fallito:', error);
    process.exitCode = 1;
});