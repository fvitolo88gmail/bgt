import fs from 'fs';
import path from 'path';
import { createServiceClient } from '../lib/supabase';

const CHUNK_MAX_WORDS = 500;
const OVERLAP_WORDS = 50;

interface ExtractedPage {
    page: number;
    content: string;
}

interface Chunk {
    page: number;
    section: string;
    content: string;
}

function splitIntoWords(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
}

function buildChunks(pages: ExtractedPage[]): Chunk[] {
    const chunks: Chunk[] = [];

    for (const { page, content } of pages) {
        const words = splitIntoWords(content);

        if (words.length <= CHUNK_MAX_WORDS) {
            chunks.push({
                page,
                section: `Pagina ${page}`,
                content: `[Pagina ${page}]\n${content}`,
            });
            continue;
        }

        // split con overlap per pagine lunghe
        let start = 0;
        let chunkIndex = 1;

        while (start < words.length) {
            const end = Math.min(start + CHUNK_MAX_WORDS, words.length);
            const chunkWords = words.slice(start, end);
            const chunkContent = chunkWords.join(' ');

            chunks.push({
                page,
                section: `Pagina ${page} (parte ${chunkIndex})`,
                content: `[Pagina ${page}]\n${chunkContent}`,
            });

            if (end === words.length) break;
            start = end - OVERLAP_WORDS;
            chunkIndex++;
        }
    }

    return chunks;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: npx ts-node scripts/ingest-pdf.ts --json <path> --game-id <uuid>');
        process.exit(1);
    }

    const jsonIndex = args.indexOf('--json');
    const gameIdIndex = args.indexOf('--game-id');

    if (jsonIndex === -1 || gameIdIndex === -1) {
        console.error('Missing --json or --game-id');
        process.exit(1);
    }

    const jsonPath = args[jsonIndex + 1];
    const gameId = args[gameIdIndex + 1];

    if (!jsonPath || !gameId) {
        console.error('Argomenti mancanti dopo --json o --game-id');
        process.exit(1);
    }

    if (!fs.existsSync(jsonPath)) {
        console.error(`File non trovato: ${jsonPath}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const pages: ExtractedPage[] = JSON.parse(raw);

    console.log(`Pagine caricate: ${pages.length}`);

    const chunks = buildChunks(pages);
    console.log(`Chunk generati: ${chunks.length}`);

    // verifica che nessun chunk superi 600 parole
    const oversized = chunks.filter(
        (c) => splitIntoWords(c.content).length > 600
    );
    if (oversized.length > 0) {
        console.warn(`⚠️  ${oversized.length} chunk superano 600 parole`);
    }

    chunks.forEach((c, i) => {
        const wordCount = splitIntoWords(c.content).length;
        console.log(`  Chunk ${i + 1}: ${c.section} — ${wordCount} parole`);
    });
}

main().catch((err) => {
    console.error('Errore:', err);
    process.exit(1);
});