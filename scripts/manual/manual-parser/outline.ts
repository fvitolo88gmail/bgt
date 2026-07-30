import { geminiClient } from '../../../lib/gemini';
import type { ExtractedPage, SectionOutline } from './types';

const OUTLINE_PROMPT = `Sei un assistente che analizza la struttura di un manuale di regole di un gioco da tavolo, estratto via OCR da un PDF (testo disordinato, colonne mischiate).

Il tuo UNICO compito è identificare i confini tra sezioni/regole distinte del documento, SENZA riscrivere o riassumere alcun contenuto.

Restituisci ESCLUSIVAMENTE un array JSON (nessun markdown, nessuna spiegazione) con questo formato:
[
  { "title": "Preparazione del Tabellone", "startPage": 4, "endPage": 5 },
  { "title": "Azione - Costruzione", "startPage": 8, "endPage": 10 }
]

Regole:
- Ogni sezione deve corrispondere a un argomento di regolamento distinto e riconoscibile.
- Usa titoli brevi e descrittivi in italiano.
- Ometti dall'elenco SOLO le parti puramente decorative/promozionali senza alcun valore informativo (crediti, link a tutorial video, aneddoti biografici sui personaggi storici citati). L'elenco dei componenti fisici del gioco NON va omesso: è un contenuto legittimo e interrogabile (es. "quanti gettoni X ci sono nella scatola?") — trattalo come una sezione a sé (es. "Componenti"). Il testo introduttivo/narrativo che descrive la premessa del gioco e l'obiettivo di ciascun ruolo NON va omesso come decorativo: contiene informazioni legittime (es. "qual è l'obiettivo della Classe Media?") — trattalo come una sezione a sé (es. "Introduzione").
- Se una sezione attraversa più pagine, indicalo con startPage/endPage.
- IMPORTANTE — evita sezioni con range di pagine sovrapposti: ogni pagina del documento deve essere il contenuto principale di UNA SOLA sezione.
- ECCEZIONE legittima: se un argomento è davvero frammentato in punti non contigui, è corretto creare sezioni separate con range diversi.
- Non includere numeri di pagina isolati o artefatti OCR come voci di sezione.`;

/**
 * Il modello a volte omette startPage/endPage o restituisce tipi sbagliati per una
 * singola sezione (osservato: endPage assente sulla prima sezione di un documento).
 * Senza questa validazione l'errore emergeva solo molto più tardi, dentro la
 * generazione vision della sezione (messaggio criptico "nessuna pagina fisica
 * trovata"), dopo aver già consumato la chiamata Gemini di Fase 1 — qui fallisce
 * subito con un messaggio che indica esattamente quale sezione è malformata.
 */
function validateOutline(parsed: unknown): SectionOutline[] {
    if (!Array.isArray(parsed)) {
        throw new Error(`L'outline non è un array JSON: ${JSON.stringify(parsed)}`);
    }

    return parsed.map((raw, index) => {
        const section = raw as Partial<SectionOutline>;
        if (typeof section.title !== 'string' || section.title.trim().length === 0) {
            throw new Error(`Outline non valido: sezione #${index} senza titolo: ${JSON.stringify(raw)}`);
        }
        if (typeof section.startPage !== 'number' || typeof section.endPage !== 'number') {
            throw new Error(
                `Outline non valido: sezione #${index} ("${section.title}") ha startPage/endPage non numerici ` +
                `(risposta malformata del modello, riprova): ${JSON.stringify(raw)}`,
            );
        }
        if (section.endPage < section.startPage) {
            throw new Error(
                `Outline non valido: sezione #${index} ("${section.title}") ha endPage < startPage: ${JSON.stringify(raw)}`,
            );
        }
        return { title: section.title, startPage: section.startPage, endPage: section.endPage };
    });
}

async function identifySectionsRaw(pages: ExtractedPage[]): Promise<SectionOutline[]> {
    const rawText = pages
        .map((p) => `--- INIZIO PAGINA ${p.page} ---\n${p.content}\n--- FINE PAGINA ${p.page} ---`)
        .join('\n\n');

    const prompt = `${OUTLINE_PROMPT}\n\nTESTO GREZZO DA ANALIZZARE:\n\n${rawText}`;
    const response = await geminiClient.generate(prompt);
    const cleaned = response.replace(/```json|```/g, '').trim();

    try {
        return validateOutline(JSON.parse(cleaned));
    } catch (err) {
        if (err instanceof SyntaxError) {
            throw new Error(`Impossibile interpretare l'outline come JSON: "${cleaned}". Errore: ${err}`);
        }
        throw err;
    }
}

function normalizeForComparison(text: string): Set<string> {
    const normalized = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return new Set(normalized.split(' ').filter((w) => w.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersectionSize = 0;
    for (const word of a) if (b.has(word)) intersectionSize++;
    const unionSize = a.size + b.size - intersectionSize;
    return unionSize > 0 ? intersectionSize / unionSize : 0;
}

export function titleSimilarity(a: string, b: string): number {
    return jaccardSimilarity(normalizeForComparison(a), normalizeForComparison(b));
}

function mergeOverlappingSections(sections: SectionOutline[]): SectionOutline[] {
    const overlapRatio = (a: SectionOutline, b: SectionOutline): number => {
        const overlapStart = Math.max(a.startPage, b.startPage);
        const overlapEnd = Math.min(a.endPage, b.endPage);
        const overlapLength = Math.max(0, overlapEnd - overlapStart + 1);
        const shorterLength = Math.min(a.endPage - a.startPage + 1, b.endPage - b.startPage + 1);
        return shorterLength > 0 ? overlapLength / shorterLength : 0;
    };

    const PAGE_OVERLAP_THRESHOLD = 0.95;
    const TITLE_SIMILARITY_THRESHOLD = 0.3;

    const merged: SectionOutline[] = [];
    const consumed = new Set<number>();

    for (let i = 0; i < sections.length; i++) {
        if (consumed.has(i)) continue;
        const initial = sections[i];
        if (!initial) continue;

        let current: SectionOutline = initial;
        for (let j = i + 1; j < sections.length; j++) {
            if (consumed.has(j)) continue;
            const candidate = sections[j];
            if (!candidate) continue;

            // Range di pagine identico (non solo overlap alto): la generazione vision vede
            // esattamente le stesse pagine per entrambe le sezioni, quindi produce quasi
            // sempre contenuto duplicato — anche quando i titoli sono troppo diversi per
            // superare TITLE_SIMILARITY_THRESHOLD (osservato su SETI: "Introduzione: X" vs
            // "X: Carte e Y", stessa pagina, similarità titolo sotto soglia). In questo caso
            // il merge scatta a prescindere dal titolo.
            const identicalRange = current.startPage === candidate.startPage && current.endPage === candidate.endPage;
            const pagesOverlap = overlapRatio(current, candidate) >= PAGE_OVERLAP_THRESHOLD;
            const titlesSimilar = titleSimilarity(current.title, candidate.title) >= TITLE_SIMILARITY_THRESHOLD;

            if (identicalRange || (pagesOverlap && titlesSimilar)) {
                console.warn(
                    `⚠️  Sezioni probabilmente duplicate: "${current.title}" [p.${current.startPage}-${current.endPage}] e "${candidate.title}" [p.${candidate.startPage}-${candidate.endPage}] — unite.`,
                );
                current = {
                    title: current.title,
                    startPage: Math.min(current.startPage, candidate.startPage),
                    endPage: Math.max(current.endPage, candidate.endPage),
                };
                consumed.add(j);
            }
        }
        merged.push(current);
    }
    return merged;
}

export async function identifySections(pages: ExtractedPage[]): Promise<SectionOutline[]> {
    const outline = await identifySectionsRaw(pages);
    return mergeOverlappingSections(outline);
}

export function checkPageCoverage(pages: ExtractedPage[], outline: SectionOutline[]): void {
    const allPageNumbers = pages.map((p) => p.page);
    const maxPage = Math.max(...allPageNumbers);

    const covered = new Set<number>();
    for (const section of outline) {
        for (let p = section.startPage; p <= section.endPage; p++) covered.add(p);
    }

    const missing: number[] = allPageNumbers.filter((p) => !covered.has(p));

    if (missing.length === 0) {
        console.log('✅ Copertura pagine: tutte le pagine sono incluse in almeno una sezione.');
        return;
    }

    const first = missing[0];
    if (first === undefined) return;

    const ranges: string[] = [];
    let start: number = first;
    let prev: number = first;

    for (let i = 1; i < missing.length; i++) {
        const current = missing[i];
        if (current === undefined) continue;
        if (current !== prev + 1) {
            ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
            start = current;
        }
        prev = current;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);

    console.warn(
        `⚠️  COPERTURA PAGINE INCOMPLETA: ${missing.length} pagine su ${maxPage} non incluse in nessuna sezione: p. ${ranges.join(', ')}`,
    );
    console.warn('    Intenzionale (crediti/indice) o bug reale? Controlla il JSON grezzo per quelle pagine.');
}