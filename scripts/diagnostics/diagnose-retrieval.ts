import 'dotenv/config';
import { geminiClient } from '../../lib/gemini';
import { createServiceClient } from '../../lib/supabase';

/**
 * Diagnostica retrieval: genera l'embedding di una query e mostra TUTTI
 * i punteggi di similarità restituiti da match_chunks, senza alcuna
 * soglia applicata — per distinguere se il problema è nel retrieval
 * stesso (chunk giusto non recuperato affatto) o in una soglia troppo
 * aggressiva applicata a valle nell'app (chunk giusto recuperato ma
 * scartato prima di arrivare al prompt).
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/diagnose-retrieval.ts \
 *     "<domanda>" --game-id <uuid> [--source manual|forum]
 */

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
    const args = process.argv.slice(2);
    const query = args[0];
    const gameId = getFlag(args, '--game-id');
    const source = getFlag(args, '--source'); // opzionale: 'manual' | 'forum'

    if (!query || !gameId) {
        console.error('Usage: npx ts-node ... scripts/diagnose-retrieval.ts "<domanda>" --game-id <uuid> [--source manual|forum]');
        process.exit(1);
    }

    console.log(`Query: "${query}"`);
    console.log(`Game ID: ${gameId}${source ? ` (source=${source})` : ''}\n`);
    console.log('Generazione embedding...');
    const embedding = await geminiClient.embed(query);
    console.log(`Embedding generato: ${embedding.length} dimensioni\n`);

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('match_chunks', {
        query_embedding: embedding,
        match_game_id: gameId,
        match_count: 10,
        filter_source: source ?? null,
    });

    if (error) {
        console.error('Errore RPC:', error.message);
        process.exit(1);
    }

    console.log('Top 10 chunk per similarità (nessuna soglia applicata):\n');
    for (const row of data ?? []) {
        const label = row.source === 'forum'
            ? `[forum] ${row.thread_subject ?? 'n/d'}`
            : `[manual] ${row.section ?? 'n/d'}`;
        console.log(`  ${(row.similarity * 100).toFixed(1)}%  —  ${label}`);
    }
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});