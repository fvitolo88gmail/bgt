import 'dotenv/config';
import { geminiClient } from '../lib/gemini';
import { createServiceClient } from '../lib/supabase';

/**
 * Diagnostica retrieval: genera l'embedding di una query e mostra TUTTI
 * i punteggi di similarità restituiti da match_chunks, senza alcuna
 * soglia applicata — per distinguere se il problema è nel retrieval
 * stesso (chunk giusto non recuperato affatto) o in una soglia troppo
 * aggressiva applicata a valle nell'app (chunk giusto recuperato ma
 * scartato prima di arrivare al prompt).
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/diagnose-retrieval.ts "Cos'è l'azione di Costruzione?"
 */

const GAME_ID = '87bb1782-dac5-4e5e-a916-9a82efa00868';

async function main() {
    const query = process.argv[2];
    if (!query) {
        console.error('Usage: npx ts-node ... scripts/diagnose-retrieval.ts "<domanda>"');
        process.exit(1);
    }

    console.log(`Query: "${query}"\n`);
    console.log('Generazione embedding...');
    const embedding = await geminiClient.embed(query);
    console.log(`Embedding generato: ${embedding.length} dimensioni\n`);

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('match_chunks', {
        query_embedding: embedding,
        match_game_id: GAME_ID,
        match_count: 10,
        filter_source: null,
    });

    if (error) {
        console.error('Errore RPC:', error.message);
        process.exit(1);
    }

    console.log('Top 10 chunk per similarità (nessuna soglia applicata):\n');
    for (const row of data ?? []) {
        console.log(`  ${(row.similarity * 100).toFixed(1)}%  —  ${row.section}`);
    }
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});