// scripts/forum/sync-forum.ts
//
// F4 — aggiornamento periodico incrementale del forum (D27/architecture.md).
// Non ripete l'intero fetch+ingest: confronta reply_count vivo su BGG con
// quello salvato in forum_threads (stato dell'ultimo ingest) per capire quali
// thread sono nuovi o hanno ricevuto nuovi post, e ri-processa solo quelli.
//
// - Thread nuovi (mai visti): aggiunti a discover.json, forum-fetch li
//   scarica come pending.
// - Thread aggiornati (reply_count aumentato): rimossi da posts.json e
//   riscaricati da zero via `fetchForumPosts(..., refetchIds)` — BGG non
//   espone i singoli post nuovi, solo il thread intero.
// - Thread invariati: nessuna chiamata BGG aggiuntiva.
//
// forum-ingest.ts resta idempotente su entrambe le tabelle: i post già
// presenti vengono saltati, solo quelli nuovi/rifetchati si aggiungono.
//
// Precondizione: la pipeline completa (discover → fetch → ingest) deve
// essere già stata eseguita almeno una volta per il gioco.
//
// Uso:
//   npx ts-node --project scripts/tsconfig.json scripts/forum/sync-forum.ts \
//     --game-slug brass --game-id {uuid}
//
// Non serve passare --bgg-id: viene letto da discover.json (legato allo
// slug) e verificato contro games.bgg_id da verifyGameIdentity.

import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getForumThreads } from '../../lib/bgg';
import { createServiceClient } from '../../lib/supabase';
import { verifyGameIdentity } from '../../lib/games';
import { fetchForumPosts } from './forum-fetch';
import { ingestForumPosts } from './forum-ingest';

interface DiscoverThread {
    threadId: number;
    subject: string;
    replyCount: number;
    postDate: string;
}

interface DiscoverFile {
    bggId: number;
    gameName: string;
    designers: string[];
    forumId: number;
    forumTitle: string;
    threads: DiscoverThread[];
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

/**
 * Rilegge tutte le pagine del forum "Rules" da BGG (stato live, non cache).
 * Ogni pagina costa una richiesta rate-limited a 5s (lib/bgg.ts) — su forum
 * grandi (centinaia di thread) l'attesa totale è di minuti: un log per
 * pagina basta a far vedere l'avanzamento senza inondare la console.
 */
async function fetchLiveThreads(forumId: number): Promise<DiscoverThread[]> {
    const threads: DiscoverThread[] = [];
    let page = 1;
    while (true) {
        console.log(`[sync]   pagina ${page}... (${threads.length} thread finora)`);
        const pageThreads = await getForumThreads(forumId, page);
        if (pageThreads.length === 0) break;
        for (const thread of pageThreads) {
            if (thread.replyCount > 0) threads.push(thread);
        }
        page += 1;
    }
    return threads;
}

async function main(): Promise<void> {
    const { gameSlug, gameId } = parseArgs();
    const discoverPath = `ingest/${gameSlug}/forum/discover.json`;

    if (!existsSync(discoverPath)) {
        throw new Error(
            `${discoverPath} non trovato — lancia prima la pipeline completa (forum-discover.ts, forum-fetch.ts, forum-ingest.ts)`
        );
    }

    const discover = JSON.parse(await readFile(discoverPath, 'utf-8')) as DiscoverFile;

    const supabase = createServiceClient();

    // --game-slug e --game-id sono flag indipendenti: verifica che puntino
    // allo stesso gioco PRIMA di leggere/scrivere qualunque dato, altrimenti
    // si confronta/scrive lo stato del gioco sbagliato (corruzione silenziosa).
    await verifyGameIdentity(supabase, gameId, discover.bggId);

    console.log(`[sync] gioco: ${discover.gameName} — rileggo lo stato live del forum "${discover.forumTitle}"...`);
    const liveThreads = await fetchLiveThreads(discover.forumId);
    console.log(`[sync] ${liveThreads.length} thread con reply_count > 0 su BGG`);

    const { data: storedThreads, error: readError } = await supabase
        .from('forum_threads')
        .select('bgg_thread_id, reply_count')
        .eq('game_id', gameId);

    if (readError) {
        throw new Error(`Errore leggendo forum_threads: ${readError.message}`);
    }

    const storedReplyCountByThread = new Map<number, number>(
        (storedThreads ?? []).map((row) => [row.bgg_thread_id as number, row.reply_count as number])
    );

    const newThreads = liveThreads.filter((t) => !storedReplyCountByThread.has(t.threadId));
    const updatedThreads = liveThreads.filter((t) => {
        const storedReplyCount = storedReplyCountByThread.get(t.threadId);
        return storedReplyCount !== undefined && t.replyCount > storedReplyCount;
    });

    console.log(`[sync] ${newThreads.length} thread nuovi, ${updatedThreads.length} thread aggiornati`);

    if (newThreads.length === 0 && updatedThreads.length === 0) {
        console.log('[sync] nessun aggiornamento — niente da fare');
        return;
    }

    if (newThreads.length > 0) {
        const alreadyInDiscover = new Set(discover.threads.map((t) => t.threadId));
        const toAdd = newThreads.filter((t) => !alreadyInDiscover.has(t.threadId));
        discover.threads.push(...toAdd);
        await writeFile(discoverPath, JSON.stringify(discover, null, 2), 'utf-8');
        console.log(`[sync] discover.json aggiornato con ${toAdd.length} thread nuovi`);
    }

    const refetchIds = new Set(updatedThreads.map((t) => t.threadId));

    console.log('[sync] fase fetch (thread nuovi + refetch aggiornati)...');
    await fetchForumPosts(gameSlug, refetchIds);

    console.log('[sync] fase ingest (storage + embedding radice, idempotente)...');
    await ingestForumPosts(gameSlug, gameId);

    console.log('[sync] completato');
}

main().catch((error) => {
    console.error('[sync] fallito:', error);
    process.exitCode = 1;
});
