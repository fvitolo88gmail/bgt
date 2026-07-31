import 'dotenv/config';
import fs from 'fs';
import { geminiClient } from '@/lib/shared/gemini';

/**
 * Step di verifica post-generazione: invece di continuare a irrigidire il
 * processo di generazione (Fase 1+2 di markdown-from-json.ts) contro ogni
 * nuovo tipo di errore osservato, confronta l'intero testo grezzo con
 * l'intero markdown finale e produce una lista puntuale di omissioni
 * sospette — un compito di verifica mirata, strutturalmente più affidabile
 * per un LLM del "genera senza mai omettere nulla" ripetuto isolatamente
 * sezione per sezione.
 *
 * Non sostituisce la revisione umana finale, ma la rende trattabile:
 * invece di rileggere l'intero manuale, il revisore controlla solo i punti
 * segnalati qui.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/verify-markdown-completeness.ts \
 *     --json ingest/hegemony/manual.json \
 *     --md ingest/hegemony/manual.md
 */

interface ExtractedPage {
    page: number;
    content: string;
}

const VERIFY_PROMPT = `Sei un revisore che confronta un TESTO GREZZO (estratto via OCR da un manuale di regole di un gioco da tavolo, con colonne disordinate e artefatti) con un MARKDOWN PULITO generato a partire da esso.

Il tuo compito è trovare OMISSIONI: informazioni presenti nel testo grezzo che NON compaiono, nemmeno riformulate, nel markdown.

Cerca specificamente:
- Numeri (costi, soglie, quantità, livelli) presenti nel grezzo ma assenti nel markdown
- Vincoli o eccezioni ("solo se", "non puoi", "a differenza di") presenti nel grezzo ma assenti nel markdown
- Interi argomenti/azioni/regole nominati nel grezzo che non hanno alcuna corrispondenza nel markdown
- Sezioni o pagine del grezzo il cui contenuto sembra completamente assente dal markdown

NON segnalare:
- Differenze di formulazione/ordine che non cambiano il significato
- Rimozione legittima di rumore OCR, crediti, indici, elenchi puramente decorativi (a meno che tu non sia sicuro contenessero informazioni di regolamento)
- Piccole imprecisioni di stile

Restituisci ESCLUSIVAMENTE un array JSON (nessuna premessa, nessun markdown, nessun blocco di codice) con questo formato:
[
  { "severity": "alta", "description": "La regola sulle Trade Unions a pagina 15 menziona un requisito di '4 lavoratori nella stessa industria' che non compare nel markdown nella sezione Classe Lavoratrice", "sourceHint": "pagina 15" },
  { "severity": "bassa", "description": "...", "sourceHint": "..." }
]

Usa "severity": "alta" per numeri/vincoli/regole mancanti, "bassa" per omissioni probabilmente innocue (dettagli decorativi, ripetizioni).
Se non trovi nessuna omissione, restituisci un array vuoto: []`;

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
    const args = process.argv.slice(2);
    const jsonPath = getFlag(args, '--json');
    const mdPath = getFlag(args, '--md');

    if (!jsonPath || !mdPath) {
        console.error('Uso: --json <path> --md <path>');
        process.exit(1);
    }

    if (!fs.existsSync(jsonPath) || !fs.existsSync(mdPath)) {
        console.error('File non trovato (controlla --json e --md)');
        process.exit(1);
    }

    const pages: ExtractedPage[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const markdown = fs.readFileSync(mdPath, 'utf-8');

    const rawText = pages
        .map((p) => `--- PAGINA ${p.page} ---\n${p.content}`)
        .join('\n\n');

    console.log(`Testo grezzo: ${rawText.split(/\s+/).length} parole`);
    console.log(`Markdown: ${markdown.split(/\s+/).length} parole`);
    console.log('Verifica in corso (chiamata Gemini su documento intero, può richiedere tempo)...\n');

    const prompt = `${VERIFY_PROMPT}\n\nTESTO GREZZO:\n\n${rawText}\n\n---\n\nMARKDOWN GENERATO:\n\n${markdown}`;

    const response = await geminiClient.generate(prompt);
    const cleaned = response.replace(/```json|```/g, '').trim();

    let findings: { severity: string; description: string; sourceHint: string }[];
    try {
        findings = JSON.parse(cleaned);
    } catch (err) {
        console.error('Impossibile interpretare la risposta come JSON:', cleaned);
        process.exit(1);
    }

    if (findings.length === 0) {
        console.log('✅ Nessuna omissione rilevata dal verificatore.');
        console.log('   (Non sostituisce comunque una revisione umana finale a campione.)');
        return;
    }

    const alta = findings.filter((f) => f.severity === 'alta');
    const bassa = findings.filter((f) => f.severity !== 'alta');

    console.log(`⚠️  ${findings.length} possibili omissioni trovate (${alta.length} alta gravità, ${bassa.length} bassa gravità):\n`);

    if (alta.length > 0) {
        console.log('--- ALTA GRAVITÀ (controllare) ---');
        alta.forEach((f, i) => console.log(`${i + 1}. [${f.sourceHint}] ${f.description}`));
        console.log('');
    }
    if (bassa.length > 0) {
        console.log('--- Bassa gravità (probabilmente ok) ---');
        bassa.forEach((f, i) => console.log(`${i + 1}. [${f.sourceHint}] ${f.description}`));
    }
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});