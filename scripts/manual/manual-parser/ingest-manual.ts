import 'dotenv/config';
import fs from 'fs';
import { identifySections, checkPageCoverage } from './outline';
import { generateSectionMarkdownFromPdf } from './generate-section';
import type { ExtractedPage, GeneratedSection } from './types';

function getFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

async function main() {
    const args = process.argv.slice(2);
    const jsonPath = getFlag(args, '--json');
    const pdfPath = getFlag(args, '--pdf');
    const outPath = getFlag(args, '--out');

    if (!jsonPath || !pdfPath || !outPath) {
        console.error('Uso: --json <path> --pdf <path> --out <path>');
        process.exit(1);
    }

    const pages: ExtractedPage[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`Pagine da processare: ${pages.length}`);
    console.log('Fase 1/2 — identificazione dei confini di sezione (testuale)...');
    const outline = await identifySections(pages);

    console.log(`Sezioni identificate: ${outline.length}`);
    outline.forEach((s) => console.log(`  - ${s.title} [p. ${s.startPage}-${s.endPage}]`));
    checkPageCoverage(pages, outline);

    console.log('\nFase 2/2 — generazione markdown via vision (PDF reale, per sezione)...');
    const generatedSections: GeneratedSection[] = [];

    for (const [i, section] of outline.entries()) {
        console.log(`  [${i + 1}/${outline.length}] ${section.title}...`);
        const body = await generateSectionMarkdownFromPdf(section, pages, pdfPath);
        const pageLabel = section.startPage === section.endPage
            ? `p. ${section.startPage}`
            : `p. ${section.startPage}-${section.endPage}`;
        generatedSections.push({ section, body: body.trim(), pageLabel });
        await new Promise((res) => setTimeout(res, 5000));
    }

    checkPageCoverage(pages, generatedSections.map((g) => g.section));

    const markdown = generatedSections
        .map((g) => `## ${g.section.title} [${g.pageLabel}]\n\n${g.body}`)
        .join('\n\n');

    fs.writeFileSync(outPath, markdown, 'utf-8');

    const rawWordCount = pages.reduce((sum, p) => sum + countWords(p.content), 0);
    const mdWordCount = countWords(markdown);
    console.log(`\nParole testo grezzo: ${rawWordCount}`);
    console.log(`Parole markdown generato: ${mdWordCount}`);
    console.log(`Rapporto: ${((mdWordCount / rawWordCount) * 100).toFixed(1)}%`);
    console.log(`\nMarkdown scritto in: ${outPath}`);
    console.log('\n⚠️  Lancia scripts/manual-parser/verify-completeness.ts come Fase 3, poi revisiona a mano.');
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});