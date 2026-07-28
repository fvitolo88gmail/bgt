import fs from 'fs';
import { splitIntoSections } from '../manual/ingest-pdf';

/**
 * Dry-run del solo parsing (splitIntoSections), senza embedding né scrittura
 * su DB — utile per verificare l'effetto di un cambio al chunking prima di
 * un re-ingest costoso.
 *
 * Uso:
 *   npx tsx scripts/diagnostics/diagnose-chunking-dry-run.ts ingest/hegemony/manual.md [filtro-titolo]
 *
 * filtro-titolo (opzionale): stampa solo le sezioni il cui titolo contiene
 * questa stringa (case-insensitive) — utile per isolare es. "Classe Media".
 */

function main() {
    const mdPath = process.argv[2];
    const filter = process.argv[3]?.toLowerCase();

    if (!mdPath) {
        console.error('Uso: npx tsx scripts/diagnostics/diagnose-chunking-dry-run.ts <path-manual.md> [filtro-titolo]');
        process.exit(1);
    }

    const markdown = fs.readFileSync(mdPath, 'utf-8');
    const sections = splitIntoSections(markdown);

    const filtered = filter
        ? sections.filter((s) => s.title.toLowerCase().includes(filter))
        : sections;

    console.log(`${sections.length} sezioni/chunk totali (${filtered.length} dopo filtro)\n`);

    filtered.forEach((s, i) => {
        const words = s.content.split(/\s+/).filter((w) => w.length > 0).length;
        console.log(`--- [${i + 1}] "${s.title}" (pagine: ${s.pages.join(',') || 'n/d'}, ${words} parole) ---`);
        console.log(s.content.slice(0, 200).replace(/\s+/g, ' ') + (s.content.length > 200 ? '...' : ''));
        console.log('');
    });
}

main();
