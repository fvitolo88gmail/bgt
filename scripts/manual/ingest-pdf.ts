import 'dotenv/config';
import fs from 'fs';
import { createServiceClient } from '../../lib/supabase';
import { geminiClient } from '../../lib/gemini';

/**
 * scripts/manual/ingest-pdf.ts (D19, aggiornato fix 0560)
 *
 * Legge il Markdown strutturato prodotto dalla pipeline di ingest manuale
 * (revisionato a mano) e crea un chunk per ogni SOTTOSEZIONE (###), non più
 * un chunk per intera sezione (##) con fallback meccanico a 500 parole.
 *
 * Motivo del cambio (vedi docs/task/0560-ingest-manuale-migliorato.md):
 * trattare "###" come testo muto dentro un chunk "##" unico causava la
 * fusione di più azioni/argomenti eterogenei in singoli chunk grandi
 * (sezioni lunghe spezzate meccanicamente in "parte 1..N" da 500 parole,
 * senza rispettare i confini delle singole sottosezioni). Risultato
 * osservato: una sottosezione specifica competeva per gli stessi slot di
 * retrieval con le altre parti della stessa sezione, e quale vincesse
 * dipendeva da rumore nella query più che dalla pertinenza reale.
 *
 * Ogni "###" diventa ora un chunk a sé, ereditando la pagina dal "##"
 * padre più vicino. Il titolo del chunk combina sezione+sottosezione
 * ("Sezione — Sottosezione") per non perdere il contesto di quale area
 * di gioco appartiene. Il testo prima della prima "###" (se presente)
 * diventa un chunk "introduttivo" a sé, titolato solo con il nome della
 * sezione "##". Se una sottosezione supera CHUNK_MAX_WORDS, viene
 * comunque sub-divisa con overlap come fallback — ma ora è un evento
 * raro, non la norma.
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

        // "###" o "####" aprono entrambi un nuovo chunk dentro la sezione
        // corrente — la pipeline vision (D36) non è coerente su quale
        // livello di header usare per le singole azioni, quindi li
        // trattiamo allo stesso modo (D39, appiattito).
        if (/^#{3,4}(?!#)\s/.test(trimmed)) {
            flushBlock();
            blockTitle = trimmed.replace(/^#{3,4}\s*/, '').trim();
            blockContent = [];
            continue;
        }

        // Una riga che è INTERAMENTE un'etichetta in grassetto (es.
        // "**Demonstration**") è trattata come lo stesso tipo di confine
        // — pattern osservato quando la vision marca le singole azioni in
        // grassetto invece che con un header Markdown vero (verificato:
        // "Strike"/"Demonstration"/"Apply Political Pressure" fuse in un
        // unico chunk, causa di un errore fattuale nella generazione).
        const boldOnlyMatch = trimmed.match(/^\*\*([A-Za-z][a-zA-Z &]*)\*\*$/);
        const boldTitle = boldOnlyMatch?.[1];
        if (boldTitle) {
            flushBlock();
            blockTitle = boldTitle;
            blockContent = [];
            continue;
        }

        // Elenco puntato "*   **Titolo Azione**" (con o senza ":" finale,
        // senza altro testo sulla stessa riga) — confine di chunk (Epica
        // 0560 punto 3, D50). Pattern molto comune per elenchi di azioni
        // nei manuali di giochi da tavolo ("Basic Actions"/"Free Actions"
        // e simili), MAI specifico a un singolo gioco. Prima di questo
        // fix, ogni bullet di questo tipo restava testo muto dentro il
        // chunk della sezione/sottosezione corrente — su una sezione con
        // molte azioni eterogenee (es. "Basic Actions": Propose Bill,
        // Build Company, Buy Goods & Services...) l'embedding del chunk
        // risultava diluito, facendo perdere sistematicamente il
        // retrieval sull'azione specifica cercata anche quando il
        // contenuto era corretto (v. D46-D48, caso Hegemony "beni di
        // magazzino/Classe Media"). Non tocca bullet con testo aggiuntivo
        // sulla stessa riga (es. "* **Industria**: Indicato dal colore.")
        // — quelli restano contenuto normale del blocco corrente, sono
        // già brevi e non affetti dal problema.
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

// Guardia di esecuzione: questo modulo viene anche importato (non solo
// eseguito da CLI) da scripts/diagnostics/diagnose-chunking-dry-run.ts per
// riusare splitIntoSections in un dry-run senza embedding/DB — senza questa
// guardia, main() (che si aspetta --md/--game-id da CLI) veniva invocato
// anche al semplice import, sovrascrivendo l'output del dry-run con
// l'errore "Argomenti mancanti".
if (require.main === module) {
    main().catch((err) => {
        console.error('Errore fatale:', err);
        process.exit(1);
    });
}