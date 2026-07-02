import 'dotenv/config';
import fs from 'fs';
import { createServiceClient } from '../lib/supabase';
import { geminiClient } from '../lib/gemini';

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
    const jsonIndex = args.indexOf('--json');
    const gameIdIndex = args.indexOf('--game-id');

    if (jsonIndex === -1 || gameIdIndex === -1) {
        console.error('Usage: npm run ingest:pdf -- --json <path> --game-id <uuid>');
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
    const chunks = buildChunks(pages);

    console.log(`Pagine: ${pages.length} — Chunk: ${chunks.length}`);

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

    await supabase
        .from('games')
        .update({ manual_ready: true })
        .eq('id', gameId);

    console.log(`\nCompletato: ${saved} salvati, ${errors} errori`);
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});