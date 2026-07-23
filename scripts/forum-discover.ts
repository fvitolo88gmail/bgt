// scripts/forum-discover.ts
//
// Fase 1/3 dell'ingest forum (D27): risolve il forum "Rules" del gioco e la
// lista dei thread con reply_count > 0 (D10). Nessun fetch dei post qui —
// solo discovery, così un rerun in caso di errore costa poche chiamate BGG.
//
// Artefatti in ingest/{game-slug}/forum/discover.json (alberatura D28).
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum-discover.ts \
//     --bgg-id 224517 --game-slug brass

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { getThing, getForumList, getForumThreads } from '../lib/bgg';

interface DiscoverOutput {
    bggId: number;
    gameName: string;
    designers: string[];
    forumId: number;
    forumTitle: string;
    threads: {
        threadId: number;
        subject: string;
        replyCount: number;
        postDate: string;
    }[];
}

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(): { bggId: number; gameSlug: string } {
    const args = process.argv.slice(2);
    const bggIdRaw = getFlag(args, '--bgg-id');
    const gameSlug = getFlag(args, '--game-slug');
    if (!bggIdRaw || !gameSlug) {
        throw new Error('Uso: --bgg-id <numero> --game-slug <slug>');
    }
    const bggId = Number.parseInt(bggIdRaw, 10);
    if (!Number.isFinite(bggId)) {
        throw new Error(`--bgg-id non valido: ${bggIdRaw}`);
    }
    return { bggId, gameSlug };
}

function findRulesForum(
    forums: { forumId: number; title: string; numThreads: number }[]
): { forumId: number; title: string; numThreads: number } {
    const exact = forums.find((f) => f.title.toLowerCase() === 'rules');
    if (exact) return exact;
    const fallback = forums.find((f) => f.title.toLowerCase().includes('rule'));
    if (fallback) return fallback;
    throw new Error(
        `Nessun forum "Rules" trovato. Forum disponibili: ${forums.map((f) => f.title).join(', ')}`
    );
}

async function main(): Promise<void> {
    const { bggId, gameSlug } = parseArgs();
    const outDir = `ingest/${gameSlug}/forum`;
    const outPath = `${outDir}/discover.json`;

    console.log(`[discover] recupero designer per bggId=${bggId}...`);
    const thing = await getThing(bggId);

    console.log('[discover] recupero lista forum...');
    const forums = await getForumList(bggId);
    const rulesForum = findRulesForum(forums);
    console.log(
        `[discover] forum trovato: "${rulesForum.title}" (id=${rulesForum.forumId}, ${rulesForum.numThreads} thread dichiarati)`
    );

    const threads: DiscoverOutput['threads'] = [];
    let page = 1;
    while (true) {
        console.log(`[discover] pagina ${page}...`);
        const pageThreads = await getForumThreads(rulesForum.forumId, page);
        if (pageThreads.length === 0) break;

        for (const thread of pageThreads) {
            if (thread.replyCount > 0) {
                threads.push(thread);
            }
        }
        page += 1;
    }

    console.log(
        `[discover] ${threads.length} thread con reply_count > 0 (su ${page - 1} pagine esplorate)`
    );

    const output: DiscoverOutput = {
        bggId: thing.bggId,
        gameName: thing.name,
        designers: thing.designers,
        forumId: rulesForum.forumId,
        forumTitle: rulesForum.title,
        threads,
    };

    await mkdir(outDir, { recursive: true });
    await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`[discover] scritto ${outPath}`);
}

main().catch((error) => {
    console.error('[discover] fallito:', error);
    process.exitCode = 1;
});