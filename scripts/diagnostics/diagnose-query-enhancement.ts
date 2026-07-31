import 'dotenv/config';
import { generateEnhancedQueries } from '@/lib/chat/service/retrieval';

/**
 * Chiama SOLO generateEnhancedQueries, senza fare retrieval, per ispezionare
 * lingua e forma reale dei paragrafi HyDE generati.
 *
 * Uso:
 *   npx tsx scripts/diagnostics/diagnose-query-enhancement.ts "<domanda>" [lingua-manuale]
 *
 * lingua-manuale (opzionale, default "en"): codice ISO 639-1 passato
 * direttamente a generateEnhancedQueries, senza leggere games.manual_language
 * dal DB.
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
