import 'dotenv/config';
import fs from 'fs';
import { createServiceClient } from '../../lib/supabase';
import { geminiClient } from '../../lib/gemini';

/**
 * Legge il Markdown strutturato prodotto dalla pipeline di ingest manuale
 * (revisionato a mano) e crea un chunk per ogni sottosezione (###), non un
 * chunk per intera sezione (##) con fallback meccanico a 500 parole —
 * altrimenti azioni/argomenti eterogenei si fondono in chunk grandi e il
 * retrieval smette di essere affidabile.
 *
 * Ogni "###" diventa un chunk a sé, ereditando la pagina dal "##" padre più
 * vicino. Il titolo combina sezione+sottosezione ("Sezione — Sottosezione").
 * Il testo prima della prima "###" (se presente) diventa un chunk
 * introduttivo a sé. Se una sottosezione supera CHUNK_MAX_WORDS, viene
 * sub-divisa con overlap come fallback raro.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/ingest-pdf.ts \
 *     --md ingest/{game-slug}/manual.md --game-id {uuid}
 */

const CHUNK_MAX_WORDS = 500;
const OVERLAP_WORDS = 50;

interface Section {
    title: string; // "Sezione — Sottosezione", o solo "Sezione" per il blocco introduttivo
    pages: number[]; // pagine ereditate dal "##" padre più vicino
    content: string;
}

interface Chunk {
    page: number | null;
    section: string;
    content: string;
}

/**
 * Estrae l'intervallo di pagine da un header tipo:
 * "## Nome Sezione [p. 10]" oppure "## Nome Sezione [p. 4-5]"
 */
function parsePagesFromHeader(headerLine: string): number[] {
    const match = headerLine.match(/\[p\.\s*(\d+)(?:-(\d+))?\]/);
    if (!match) return [];

    const startGroup = match[1];
    if (!startGroup) return [];

    const start = parseInt(startGroup, 10);
    const end = match[2] ? parseInt(match[2], 10) : start;

    const pages: number[] = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
}

function cleanTitle(headerLine: string): string {
    return headerLine
        .replace(/^##+\s*/, '')
        .replace(/\[p\.\s*\d+(?:-\d+)?\]/, '')
        .trim();
}

function cleanSubTitle(headerLine: string): string {
    return headerLine.replace(/^###\s*/, '').trim();
}

/**
 * Due livelli di confine: "##" apre una nuova sezione top-level (pagina),
 * "###"/"####"/etichetta in grassetto aprono un nuovo chunk DENTRO la
 * sezione corrente, ereditandone la pagina. Header più profondi restano
 * contenuto normale del chunk corrente — non aprono un ulteriore livello
 * di split.
 */
export function splitIntoSections(markdown: string): Section[] {
    const lines = markdown.split('\n');
    const sections: Section[] = [];

    let sectionTitle: string | null = null;
    let sectionPages: number[] = [];

    let blockTitle: string | null = null; // null = blocco introduttivo, prima di qualsiasi "###"
    let blockContent: string[] = [];

    const flushBlock = () => {
        if (sectionTitle === null) return;
        const content = blockContent.join('\n').trim();
        if (content.length === 0) return;
        const title = blockTitle ? `${sectionTitle} — ${blockTitle}` : sectionTitle;
        sections.push({ title, pages: sectionPages, content });
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (/^##(?!#)\s/.test(trimmed)) {
            flushBlock();
            sectionTitle = cleanTitle(line);
            sectionPages = parsePagesFromHeader(line);
            blockTitle = null;
            blockContent = [];
            continue;
        }

        // "###" e "####" aprono entrambi un nuovo chunk dentro la sezione
        // corrente — la pipeline di estrazione non è coerente su quale
        // livello di header usare per le singole azioni.
        if (/^#{3,4}(?!#)\s/.test(trimmed)) {
            flushBlock();
            blockTitle = trimmed.replace(/^#{3,4}\s*/, '').trim();
            blockContent = [];
            continue;
        }

        // Una riga INTERAMENTE in grassetto (es. "**Demonstration**") è
        // trattata come lo stesso tipo di confine — pattern usato quando
        // l'estrazione marca le singole azioni in grassetto invece che
        // con un header Markdown vero.
        const boldOnlyMatch = trimmed.match(/^\*\*([A-Za-z][a-zA-Z &]*)\*\*$/);
        const boldTitle = boldOnlyMatch?.[1];
        if (boldTitle) {
            flushBlock();
            blockTitle = boldTitle;
            blockContent = [];
            continue;
        }

        // Elenco puntato "*   **Titolo Azione**" (con o senza ":" finale,
        // senza altro testo sulla riga) — confine di chunk. Comune negli
        // elenchi di azioni dei manuali ("Basic Actions"/"Free Actions").
        // Senza questo, un bullet di questo tipo resta testo muto dentro
        // il chunk della sezione corrente, e su sezioni con molte azioni
        // eterogenee l'embedding risulta diluito e perde il retrieval
        // sull'azione specifica. Non tocca bullet con testo aggiuntivo
        // sulla stessa riga (es. "* **Industria**: Indicato dal colore.").
        const bulletTitleMatch = trimmed.match(/^\*\s+\*\*([A-Za-z][a-zA-Z0-9 &/'’,()-]*)\*\*:?\s*$/);
        const bulletTitle = bulletTitleMatch?.[1];
        if (bulletTitle) {
            flushBlock();
            blockTitle = bulletTitle;
            blockContent = [];
            continue;
        }

        // "#####" e oltre, o testo normale: contenuto del blocco corrente
        blockContent.push(line);
    }
    flushBlock();

    return sections;
}

function splitIntoWords(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Un chunk = una sezione/sottosezione, salvo che sia troppo lunga: in quel
 * caso viene sub-divisa con overlap, come fallback (ora raro, dato che le
 * sottosezioni sono naturalmente più piccole delle vecchie sezioni intere).
 */
function buildChunks(sections: Section[]): Chunk[] {
    const chunks: Chunk[] = [];

    for (const section of sections) {
        const words = splitIntoWords(section.content);
        const firstPage = section.pages[0] ?? null;

        if (words.length <= CHUNK_MAX_WORDS) {
            chunks.push({
                page: firstPage,
                section: section.title,
                content: `[${section.title}]\n${section.content}`,
            });
            continue;
        }

        let start = 0;
        let partIndex = 1;

        while (start < words.length) {
            const end = Math.min(start + CHUNK_MAX_WORDS, words.length);
            const chunkWords = words.slice(start, end);
            const chunkContent = chunkWords.join(' ');
            const partTitle = `${section.title} (parte ${partIndex})`;

            chunks.push({
                page: firstPage,
                section: partTitle,
                content: `[${partTitle}]\n${chunkContent}`,
            });

            if (end === words.length) break;
            start = end - OVERLAP_WORDS;
            partIndex++;
        }
    }

    return chunks;
}

async function main() {
    const args = process.argv.slice(2);
    const mdIndex = args.indexOf('--md');
    const gameIdIndex = args.indexOf('--game-id');

    if (mdIndex === -1 || gameIdIndex === -1) {
        console.error(
            'Usage: npx ts-node --project scripts/tsconfig.json scripts/ingest-pdf.ts --md <path> --game-id <uuid>',
        );
        process.exit(1);
    }

    const mdPath = args[mdIndex + 1];
    const gameId = args[gameIdIndex + 1];

    if (!mdPath || !gameId) {
        console.error('Argomenti mancanti dopo --md o --game-id');
        process.exit(1);
    }

    if (!fs.existsSync(mdPath)) {
        console.error(`File non trovato: ${mdPath}`);
        process.exit(1);
    }

    const markdown = fs.readFileSync(mdPath, 'utf-8');

    if (markdown.includes('<!-- OCR illeggibile') || markdown.includes('illeggibile, verificare manualmente')) {
        console.warn(
            '⚠️  Attenzione: il markdown contiene marcature "illeggibile" non risolte. Verifica di averle revisionate prima di procedere.',
        );
    }

    const sections = splitIntoSections(markdown);
    const chunks = buildChunks(sections);

    console.log(`Sezioni/sottosezioni: ${sections.length} — Chunk: ${chunks.length}`);

    const supabase = createServiceClient();

    const { data: existingRows, error: existingError } = await supabase
        .from('chunks')
        .select('page, section')
        .eq('game_id', gameId)
        .eq('source', 'manual');

    if (existingError) {
        console.error('Errore leggendo chunk esistenti:', existingError.message);
        process.exit(1);
    }

    const alreadyIngested = new Set(
        (existingRows ?? []).map((row) => `${row.page}::${row.section}`)
    );
    console.log(`${alreadyIngested.size} chunk già presenti, verranno saltati`);

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    for (const [i, chunk] of chunks.entries()) {
        const key = `${chunk.page}::${chunk.section}`;
        if (alreadyIngested.has(key)) {
            skipped += 1;
            continue;
        }

        console.log(`Embedding chunk ${i + 1}/${chunks.length}: ${chunk.section}...`);

        try {
            const embedding = await geminiClient.embed(chunk.content);

            const { error } = await supabase.from('chunks').insert({
                game_id: gameId,
                source: 'manual',
                content: chunk.content,
                embedding,
                model_version: process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001',
                page: chunk.page,
                section: chunk.section,
            });

            if (error) {
                console.error(`  Errore salvataggio chunk ${i + 1}:`, error.message);
                errors++;
            } else {
                saved++;
            }

            await new Promise((res) => setTimeout(res, 800));
        } catch (err) {
            console.error(`  Errore embedding chunk ${i + 1}:`, err);
            errors++;
        }
    }

    await supabase.from('games').update({ manual_ready: true }).eq('id', gameId);

    console.log(`\nCompletato: ${saved} salvati, ${skipped} già presenti (saltati), ${errors} errori`);
}

// Guardia di esecuzione: il modulo viene anche importato (non solo
// eseguito da CLI) per riusare splitIntoSections in un dry-run senza
// embedding/DB — senza questa guardia main() partirebbe anche all'import.
if (require.main === module) {
    main().catch((err) => {
        console.error('Errore fatale:', err);
        process.exit(1);
    });
}