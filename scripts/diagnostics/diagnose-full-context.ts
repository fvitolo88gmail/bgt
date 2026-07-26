import 'dotenv/config';
import { matchChunksForPrompt } from '../../lib/retrieval';

/**
 * scripts/diagnose-full-context.ts
 *
 * A differenza di diagnose-retrieval.ts (che chiama matchChunks sulla
 * query grezza, senza arricchimento), questo script chiama
 * matchChunksForPrompt ESATTAMENTE come fa /api/chat — incluso il query
 * enhancement (decomposizione + HyDE, D31) e l'espansione forum (F5).
 * Mostra il contesto FINALE, reale, che arriva al prompt di generazione.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/diagnose-full-context.ts \
 *     "La classe media può usare i propri beni per se stessa?" \
 *     d17ebf75-284a-4a4d-b3fa-0cc16287fce4
 */

async function main() {
    const query = process.argv[2];
    const gameId = process.argv[3];

    if (!query || !gameId) {
        console.error('Uso: npx ts-node ... scripts/diagnose-full-context.ts "<domanda>" <game-id>');
        process.exit(1);
    }

    console.log(`Query: "${query}"`);
    console.log(`Game ID: ${gameId}\n`);
    console.log('Chiamata matchChunksForPrompt (con query enhancement + espansione forum)...\n');

    const result = await matchChunksForPrompt(query, gameId, 5);

    console.log(`Contesto finale: ${result.context.length} chunk assemblati per il prompt\n`);
    result.context.forEach((c, i) => {
        console.log(`--- Chunk ${i + 1} — fonte: "${c.sourceLabel}" ---`);
        console.log(c.content.slice(0, 300).replace(/\s+/g, ' ') + (c.content.length > 300 ? '...' : ''));
        console.log('');
    });

    console.log('--- sources (match finali NON espansi, oggetto grezzo per sicurezza tipi) ---');
    result.sources.forEach((s: unknown, i: number) => {
        console.log(`  ${i + 1}.`, JSON.stringify(s, null, 2).slice(0, 400));
    });
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});