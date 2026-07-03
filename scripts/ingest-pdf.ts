import 'dotenv/config';
import fs from 'fs';
import { createServiceClient } from '../lib/supabase';
import { geminiClient } from '../lib/gemini';

/**
 * scripts/ingest-pdf.ts (D19)
 *
 * Legge il Markdown strutturato prodotto da markdown-from-json.ts
 * (e revisionato a mano) e crea un chunk per ogni sezione (## header),
 * invece del precedente chunking meccanico a 500 parole indipendente
 * dalla struttura semantica del documento.
 *
 * Se una sezione supera CHUNK_MAX_WORDS viene comunque sub-divisa con
 * overlap, per evitare chunk enormi — ma il taglio di default rispetta
 * sempre i confini di sezione.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/ingest-pdf.ts \
 *     --md manuals/brass.md --game-id {uuid}
 */

const CHUNK_MAX_WORDS = 500;
const OVERLAP_WORDS = 50;

interface Section {
    title: string;
    pages: number[]; // pagine di origine estratte dall'header, es. [10, 11]
    content: string;
}

interface Chunk {
    page: number | null;
    section: string;
    content: string;
}

/**
 * Estrae l'intervallo di pagine da un header tipo:
 * "## Azione - Vendita [p. 10]" oppure "## Setup [p. 4-5]"
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

function splitIntoSections(markdown: string): Section[] {
    const lines = markdown.split('\n');
    const sections: Section[] = [];

    let currentTitle: string | null = null;
    let currentPages: number[] = [];
    let currentContent: string[] = [];

    const flush = () => {
        if (currentTitle === null) return;
        sections.push({
            title: currentTitle,
            pages: currentPages,
            content: currentContent.join('\n').trim(),
        });
    };

    for (const line of lines) {
        if (line.trim().startsWith('##')) {
            flush();
            currentTitle = cleanTitle(line);
            currentPages = parsePagesFromHeader(line);
            currentContent = [];
        } else {
            currentContent.push(line);
        }
    }
    flush();

    return sections.filter((s) => s.content.length > 0);
}

function splitIntoWords(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Un chunk = una sezione, salvo che la sezione sia troppo lunga:
 * in quel caso viene sub-divisa mantenendo l'overlap, come fallback.
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

        // Sezione troppo lunga: sub-dividi con overlap, mantenendo il
        // riferimento alla sezione originale nel nome (parte N).
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

    if (markdown.includes('<!-- OCR illeggibile')) {
        console.warn(
            '⚠️  Attenzione: il markdown contiene marcature "OCR illeggibile" non risolte. Verifica di averle revisionate prima di procedere.',
        );
    }

    const sections = splitIntoSections(markdown);
    const chunks = buildChunks(sections);

    console.log(`Sezioni: ${sections.length} — Chunk: ${chunks.length}`);

    const supabase = createServiceClient();
    let saved = 0;
    let errors = 0;

    for (const [i, chunk] of chunks.entries()) {
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

            // pausa per evitare rate limit Gemini
            await new Promise((res) => setTimeout(res, 200));
        } catch (err) {
            console.error(`  Errore embedding chunk ${i + 1}:`, err);
            errors++;
        }
    }

    await supabase.from('games').update({ manual_ready: true }).eq('id', gameId);

    console.log(`\nCompletato: ${saved} salvati, ${errors} errori`);
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});