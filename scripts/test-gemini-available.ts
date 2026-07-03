import 'dotenv/config';
import { geminiClient } from '../lib/gemini';

/**
 * Test minimo e isolato: verifica se le chiamate Gemini (embed) sono
 * di nuovo disponibili dopo un rate limit, senza toccare il resto
 * della pipeline. Una sola chiamata, per non consumare quota extra.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/test-gemini-available.ts
 */

async function main() {
    console.log('Provo una singola chiamata embed()...');
    try {
        const result = await geminiClient.embed('test di disponibilità');
        console.log(`✅ Funziona. Vettore di ${result.length} dimensioni ricevuto.`);
    } catch (err) {
        console.log('❌ Ancora bloccato:');
        console.error(err instanceof Error ? err.message : err);
    }
}

main();