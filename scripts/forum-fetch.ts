// scripts/forum-fetch.ts
//
// Fase 2/3 dell'ingest forum (D27): scarica i post di ogni thread trovato
// da forum-discover.ts, li pulisce (lib/bgg-clean.ts). NESSUN filtro di
// lunghezza per post (D10 non si applica più qui): con l'approccio
// small-to-big, solo la radice del thread viene embeddata — un post breve
// isolato ("Sì è corretto") non serve a essere trovato da solo, serve solo
// come contenuto grezzo recuperabile in fase di espansione (F5).
//
// RESUMABILE: se posts.json esiste già, i thread già presenti vengono
// saltati. Scrittura atomica (tmp+rename) dopo OGNI thread.
//
// Legge/scrive in ingest/{game-slug}/forum/ (alberatura D28).
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum-fetch.ts \
//     --game-slug brass
//   npx ts-node --project scripts/tsconfig.json scripts/forum-fetch.ts \
//     --game-slug brass --refetch 3724051,3429143

import 'dotenv/config';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getThread } from '../lib/bgg';
import { cleanForumBody } from '../lib/bgg-clean';

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
    quotedAuthor: string | null;
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

function parseArgs(): { gameSlug: string; refetchIds: Set<number> } {
    const args = process.argv.slice(2);
    const gameSlug = getFlag(args, '--game-slug');
    if (!gameSlug) {
        throw new Error('Uso: --game-slug <slug> [--refetch <id1,id2,...>]');
    }
    const refetchRaw = getFlag(args, '--refetch');
    const refetchIds = new Set(
        (refetchRaw ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((s) => Number.parseInt(s, 10))
            .filter((n) => Number.isFinite(n))
    );
    return { gameSlug, refetchIds };
}

async function loadExistingOutput(
    outPath: string,
    fallback: Pick<FetchOutput, 'bggId' | 'gameName' | 'designers'>
): Promise<FetchOutput> {
    if (!existsSync(outPath)) {
        return { ...fallback, threads: [] };
    }
    const raw = await readFile(outPath, 'utf-8');
    if (raw.trim().length === 0) {
        return { ...fallback, threads: [] };
    }
    return JSON.parse(raw) as FetchOutput;
}

async function writeOutputAtomic(outPath: string, output: FetchOutput): Promise<void> {
    const tmpPath = `${outPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(output, null, 2), 'utf-8');
    await rename(tmpPath, outPath);
}

async function main(): Promise<void> {
    const { gameSlug, refetchIds } = parseArgs();
    const dir = `ingest/${gameSlug}/forum`;
    const inPath = `${dir}/discover.json`;
    const outPath = `${dir}/posts.json`;

    if (!existsSync(inPath)) {
        throw new Error(`${inPath} non trovato — lancia prima forum-discover.ts`);
    }

    const discover = JSON.parse(await readFile(inPath, 'utf-8')) as DiscoverInput;
    const output = await loadExistingOutput(outPath, {
        bggId: discover.bggId,
        gameName: discover.gameName,
        designers: discover.designers,
    });

    if (refetchIds.size > 0) {
        const before = output.threads.length;
        output.threads = output.threads.filter((t) => !refetchIds.has(t.threadId));
        const removed = before - output.threads.length;
        console.log(`[fetch] --refetch: rimossi ${removed}/${refetchIds.size} thread (torneranno pending)`);
        if (removed > 0) {
            await mkdir(dir, { recursive: true });
            await writeOutputAtomic(outPath, output);
        }
    }

    const alreadyFetched = new Set(output.threads.map((t) => t.threadId));
    const pending = discover.threads.filter((t) => !alreadyFetched.has(t.threadId));

    console.log(`[fetch] ${alreadyFetched.size} thread già scaricati, ${pending.length} da fare`);

    await mkdir(dir, { recursive: true });

    let done = 0;
    let errori = 0;
    for (const thread of pending) {
        try {
            const detail = await getThread(thread.threadId);

            const posts: FetchedPost[] = detail.posts.map((post) => {
                const { bodyClean, quotedAuthor } = cleanForumBody(post.body);
                return {
                    postId: post.postId,
                    authorUsername: post.authorUsername,
                    postDate: post.postDate,
                    bodyClean,
                    quotedAuthor,
                };
            });

            output.threads.push({
                threadId: thread.threadId,
                subject: thread.subject,
                replyCount: thread.replyCount,
                posts,
            });
            await writeOutputAtomic(outPath, output);

            done += 1;
            console.log(`[fetch] ${done}/${pending.length} — thread ${thread.threadId} (${posts.length} post)`);
        } catch (error) {
            errori += 1;
            console.error(`[fetch] errore su thread ${thread.threadId}:`, error);
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