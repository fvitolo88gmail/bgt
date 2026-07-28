import 'dotenv/config';
import { generateEnhancedQueries } from '../../lib/retrieval';

/**
 * scripts/diagnose-query-enhancement.ts
 *
 * Verifica isolata di un'ipotesi (sessione 2026-07-27): QUERY_ENHANCEMENT_PROMPT
 * in lib/retrieval.ts non specifica esplicitamente la lingua di output dei
 * paragrafi HyDE generati. Se il modello li genera in italiano (come la
 * domanda e il prompt stesso), il query enhancement non chiude il gap
 * cross-lingua query-IT / manuale-EN che è emerso come causa sospetta della
 * similarità strutturalmente bassa (65-79%) osservata sui chunk manuale.
 *
 * Questo script chiama SOLO generateEnhancedQueries, senza fare retrieval,
 * per ispezionare la lingua e la forma reale dell'output.
 *
 * Uso:
 *   npx tsx scripts/diagnostics/diagnose-query-enhancement.ts "<domanda>" [lingua-manuale]
 *
 * lingua-manuale (opzionale, default "en"): codice ISO 639-1 passato
 * direttamente a generateEnhancedQueries, senza leggere games.manual_language
 * dal DB — utile per testare il fix (Epica 0551, L2) senza dover prima
 * applicare/verificare la migration.
 */

async function main() {
    const query = process.argv[2];
    const manualLanguage = process.argv[3] ?? 'en';

    if (!query) {
        console.error('Uso: npx tsx scripts/diagnostics/diagnose-query-enhancement.ts "<domanda>" [lingua-manuale]');
        process.exit(1);
    }

    console.log(`Query originale: "${query}"`);
    console.log(`Lingua manuale target: "${manualLanguage}"\n`);
    console.log('Generazione paragrafi HyDE (decomposizione + HyDE)...\n');

    const enhanced = await generateEnhancedQueries(query, manualLanguage);

    if (enhanced.length === 0) {
        console.log('⚠️  Nessun paragrafo generato (enhancement fallito o vuoto — v. log stderr sopra).');
        return;
    }

    console.log(`${enhanced.length} paragrafo/i generato/i:\n`);
    enhanced.forEach((p, i) => {
        console.log(`--- Paragrafo ${i + 1} ---`);
        console.log(p);
        console.log('');
    });

    console.log('Verifica manualmente: i paragrafi sopra sono in italiano o in inglese?');
    console.log('Se sono in italiano, il gap cross-lingua query-IT/manuale-EN NON viene chiuso da questo step.');
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});
