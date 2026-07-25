import 'dotenv/config';
import { generateSectionMarkdownFromPdf } from './generate-section';
import type { ExtractedPage, SectionOutline } from './types';
import fs from 'fs';

/**
 * scripts/manual-parser/regenerate-section.ts
 *
 * Rigenera UNA sola sezione (via vision, stessa logica di ingest-manual.ts)
 * senza rifare l'intera Fase 1+2. Utile per correzioni mirate quando la
 * revisione (manuale o verify-completeness.ts) individua un problema
 * isolato a poche sezioni — es. lingua sbagliata, dettaglio mancante —
 * invece di rilanciare tutte le N sezioni e sprecare quota.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/manual-parser/regenerate-section.ts \
 *     --json ingest/hegemony/manual.json \
 *     --pdf ingest/hegemony/manual.pdf \
 *     --title "Componenti" --start 2 --end 3
 *
 * Stampa il markdown rigenerato su stdout: copialo a mano nel punto giusto
 * di manual.md, così mantieni il controllo finale su cosa entra nel file.
 */

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
    const args = process.argv.slice(2);
    const jsonPath = getFlag(args, '--json');
    const pdfPath = getFlag(args, '--pdf');
    const title = getFlag(args, '--title');
    const startRaw = getFlag(args, '--start');
    const endRaw = getFlag(args, '--end');

    if (!jsonPath || !pdfPath || !title || !startRaw || !endRaw) {
        console.error('Uso: --json <path> --pdf <path> --title "<titolo>" --start N --end N');
        process.exit(1);
    }

    const pages: ExtractedPage[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const section: SectionOutline = {
        title,
        startPage: parseInt(startRaw, 10),
        endPage: parseInt(endRaw, 10),
    };

    console.error(`Rigenero "${title}" [p. ${section.startPage}-${section.endPage}]...`);
    const body = await generateSectionMarkdownFromPdf(section, pages, pdfPath);

    const pageLabel = section.startPage === section.endPage
        ? `p. ${section.startPage}`
        : `p. ${section.startPage}-${section.endPage}`;

    console.log(`## ${section.title} [${pageLabel}]\n\n${body.trim()}`);
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});