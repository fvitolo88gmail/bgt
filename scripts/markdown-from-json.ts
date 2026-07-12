import 'dotenv/config';
import fs from 'fs';
import { geminiClient } from '../lib/gemini';

/**
 * scripts/markdown-from-json.ts
 *
 * Step di ingest (D19): trasforma il JSON grezzo prodotto da extract-pdf.py
 * in un Markdown pulito, strutturato per sezioni semantiche (## header),
 * usando Gemini SOLO per pulizia strutturale — non per correggere, dedurre
 * o riformulare il contenuto delle regole.
 *
 * Processo in DUE FASI, per ridurre il rischio di riassunto/omissione
 * osservato quando l'intero documento viene passato in un'unica chiamata:
 *   Fase 1 — una chiamata sull'intero documento SOLO per identificare i
 *            confini di sezione (titolo + range di pagine), senza
 *            riscrivere il contenuto.
 *   Fase 2 — una chiamata PER SEZIONE, passando solo il testo grezzo delle
 *            pagine di quella sezione, con l'istruzione esplicita di non
 *            comprimere/riassumere nulla. Meno testo per chiamata = meno
 *            tentazione del modello di accorciare frasi con più condizioni.
 *
 * L'output va SEMPRE revisionato a mano contro il PDF originale prima di
 * essere passato a ingest-pdf.ts (vedi decision-log.md D19).
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/markdown-from-json.ts \
 *     --json manuals/brass.json --out manuals/brass.md
 */

interface ExtractedPage {
    page: number;
    content: string;
}

interface SectionOutline {
    title: string;
    startPage: number;
    endPage: number;
}

// --- Fase 1: identificazione dei confini di sezione ------------------

const OUTLINE_PROMPT = `Sei un assistente che analizza la struttura di un manuale di regole di un gioco da tavolo, estratto via OCR da un PDF (testo disordinato, colonne mischiate).

Il tuo UNICO compito è identificare i confini tra sezioni/regole distinte del documento, SENZA riscrivere o riassumere alcun contenuto.

Restituisci ESCLUSIVAMENTE un array JSON (nessun markdown, nessuna spiegazione) con questo formato:
[
  { "title": "Preparazione del Tabellone", "startPage": 4, "endPage": 5 },
  { "title": "Azione - Costruzione", "startPage": 8, "endPage": 10 }
]

Regole:
- Ogni sezione deve corrispondere a un argomento di regolamento distinto e riconoscibile (es. una singola azione di gioco, una fase di preparazione, una regola di fine partita).
- Usa titoli brevi e descrittivi in italiano.
- Ometti dall'elenco SOLO le parti puramente decorative/promozionali senza alcun valore di regola (crediti, elenco componenti fisici, link a tutorial video, aneddoti biografici sui personaggi storici citati).
- Se una sezione attraversa più pagine, indicalo con startPage/endPage.
- IMPORTANTE — evita sezioni con range di pagine sovrapposti: ogni pagina del documento deve essere il contenuto principale di UNA SOLA sezione. Se due argomenti diversi condividono fisicamente la stessa pagina (es. "Fine Turno" e "Vincere la Partita" sono entrambi a pagina 7), NON creare due sezioni che includono entrambe l'intera pagina 7 — scegli a quale delle due appartiene principalmente quella pagina, oppure dividi il contenuto assegnando la pagina a una sola sezione. È un errore avere lo stesso argomento descritto in due sezioni diverse con lo stesso range di pagine: quello è un duplicato, non due sezioni.
- ECCEZIONE legittima alla regola precedente: se un argomento è davvero frammentato in punti non contigui del documento (es. una regola introdotta a pagina 6 e ripresa con dettagli diversi a pagina 10), è corretto creare sezioni separate con range diversi — questo non è un duplicato, è contenuto complementare in punti diversi. Il problema da evitare è solo quando range IDENTICI o quasi identici producono contenuto ripetuto.
- Non includere numeri di pagina isolati o artefatti OCR come voci di sezione.`;

async function identifySections(pages: ExtractedPage[]): Promise<SectionOutline[]> {
    const rawText = pages
        .map((p) => `--- INIZIO PAGINA ${p.page} ---\n${p.content}\n--- FINE PAGINA ${p.page} ---`)
        .join('\n\n');

    const prompt = `${OUTLINE_PROMPT}\n\nTESTO GREZZO DA ANALIZZARE:\n\n${rawText}`;

    const response = await geminiClient.generate(prompt);
    const cleaned = response.replace(/```json|```/g, '').trim();

    let outline: SectionOutline[];
    try {
        outline = JSON.parse(cleaned) as SectionOutline[];
    } catch (err) {
        throw new Error(
            `Impossibile interpretare l'outline delle sezioni come JSON: "${cleaned}". Errore: ${err}`,
        );
    }

    return mergeOverlappingSections(outline);
}

/**
 * Fix A (D19/D20): rileva sezioni con range di pagine IDENTICI (o quasi:
 * tolleranza minima) E titoli semanticamente simili — segnale che
 * l'outline ha probabilmente prodotto due sezioni per lo stesso
 * contenuto — e le unisce prima della Fase 2.
 *
 * NOTA IMPORTANTE (revisione dopo il primo tentativo): una soglia basata
 * solo sull'overlap di pagine è troppo aggressiva quando più azioni
 * distinte condividono la stessa pagina fisica (es. "Prestito",
 * "Sviluppo", "Espansione della Rete", "Ricognizione" possono stare
 * tutte su un'unica pagina 11 per motivi di impaginazione, ma sono 4
 * regole indipendenti, non un duplicato). Fondere sezioni così ha
 * causato una regressione: il modello, ricevendo più testo grezzo
 * misto in una sola chiamata, ha rimescolato frammenti di regole
 * diverse (stesso tipo di errore visto nel debug di Cementificazione).
 *
 * Ora richiediamo overlap di pagine QUASI TOTALE (>=95%, praticamente
 * lo stesso range) E titoli testualmente simili, per intercettare solo
 * il caso vero (outline che ha duplicato la stessa sezione con lo
 * stesso nome o sinonimo) senza toccare sezioni che condividono solo
 * la pagina fisica per ragioni di impaginazione.
 */
function titleSimilarity(a: string, b: string): number {
    return jaccardSimilarity(normalizeForComparison(a), normalizeForComparison(b));
}

function mergeOverlappingSections(sections: SectionOutline[]): SectionOutline[] {
    const overlapRatio = (a: SectionOutline, b: SectionOutline): number => {
        const overlapStart = Math.max(a.startPage, b.startPage);
        const overlapEnd = Math.min(a.endPage, b.endPage);
        const overlapLength = Math.max(0, overlapEnd - overlapStart + 1);
        const shorterLength = Math.min(
            a.endPage - a.startPage + 1,
            b.endPage - b.startPage + 1,
        );
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

            const pagesOverlap = overlapRatio(current, candidate) >= PAGE_OVERLAP_THRESHOLD;
            const titlesSimilar =
                titleSimilarity(current.title, candidate.title) >= TITLE_SIMILARITY_THRESHOLD;

            if (pagesOverlap && titlesSimilar) {
                console.warn(
                    `⚠️  Sezioni probabilmente duplicate rilevate (stesso range di pagine e titoli simili): "${current.title}" [p.${current.startPage}-${current.endPage}] e "${candidate.title}" [p.${candidate.startPage}-${candidate.endPage}] — unite in una sola sezione.`,
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

// --- Fase 2: generazione markdown per singola sezione ------------------

const SECTION_PROMPT = `Sei un assistente di formattazione. Il tuo unico compito è ripulire il testo grezzo (estratto via OCR, spesso con colonne mischiate) di UNA sezione di un manuale di regole di un gioco da tavolo, in Markdown leggibile.

REGOLE FERREE — la violazione di una qualsiasi di queste rende il tuo output inutilizzabile:
1. NON correggere, dedurre, riformulare, riassumere o interpretare il contenuto delle regole. Il testo deve rimanere semanticamente identico all'originale, il più vicino possibile alla formulazione letterale.
2. NON aggiungere informazioni non esplicitamente presenti nel testo grezzo.
3. NON omettere NULLA che contenga un numero (costi, soglie, quantità, livelli, distanze), un vincolo ("puoi", "non puoi", "solo se", "massimo", "richiede"), un'eccezione ("a differenza di", "eccezione:", "ma non"), o un elenco di opzioni/bonus. Se il testo originale elenca 3 tipi di bonus con valori diversi, il markdown deve riportare tutti e 3 con i loro valori, non un riassunto generico come "ricevi un bonus".
4. NON accorciare una frase che descrive più condizioni in sequenza in un'unica frase generica. Se un'azione richiede più passaggi distinti, elencali come passaggi distinti.
5. Il tuo compito di pulizia è SOLO: rimuovere artefatti OCR (numeri di pagina isolati, parole spezzate a metà, colonne mischiate che rendono il testo illeggibile), sistemare la punteggiatura/paragrafazione quando è chiaramente rotta, e formattare in Markdown leggibile (liste puntate, paragrafi).
6. Se una parte del testo è illeggibile o troppo corrotta per essere ricostruita con certezza, NON provare a indovinare: lasciala così com'è e aggiungi un commento HTML <!-- OCR illeggibile, verificare manualmente --> subito prima.

Restituisci ESCLUSIVAMENTE il contenuto Markdown della sezione (senza l'header ##, verrà aggiunto separatamente), senza premessa, spiegazioni, o blocchi di codice attorno.`;

async function generateSectionMarkdown(
    section: SectionOutline,
    pages: ExtractedPage[],
): Promise<string> {
    const relevantPages = pages.filter(
        (p) => p.page >= section.startPage && p.page <= section.endPage,
    );
    const rawText = relevantPages
        .map((p) => `--- INIZIO PAGINA ${p.page} ---\n${p.content}\n--- FINE PAGINA ${p.page} ---`)
        .join('\n\n');

    const prompt = `${SECTION_PROMPT}\n\nSEZIONE: ${section.title}\n\nTESTO GREZZO DA RIPULIRE (nota: questo testo può contenere anche contenuto di altre sezioni mescolato per via del layout a colonne del PDF originale — includi SOLO le parti pertinenti a "${section.title}", ma non perdere alcun dettaglio di questa sezione):\n\n${rawText}`;

    return geminiClient.generate(prompt);
}

function countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Fix B (D19/D20): rete di sicurezza indipendente dal Fix A. Anche se
 * l'outline non produce range di pagine sovrapposti, due sezioni potrebbero
 * comunque generare contenuto quasi identico (es. lo stesso argomento
 * descritto con parole leggermente diverse in due punti del documento
 * grezzo). Confrontiamo il testo NORMALIZZATO (minuscolo, spazi
 * collassati, punteggiatura rimossa) di ogni coppia di sezioni generate:
 * se la similarità supera la soglia, la sezione più corta viene scartata
 * come duplicato.
 *
 * Usiamo la similarità di Jaccard sui set di parole (non n-gram, non
 * embedding) per restare deterministico e senza costo di chiamate
 * aggiuntive: è un controllo grezzo ma sufficiente per il caso che
 * cerchiamo — due sezioni che raccontano la stessa regola quasi con le
 * stesse parole, non contenuto semplicemente correlato.
 */
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
    for (const word of a) {
        if (b.has(word)) intersectionSize++;
    }
    const unionSize = a.size + b.size - intersectionSize;
    return unionSize > 0 ? intersectionSize / unionSize : 0;
}

interface GeneratedSection {
    section: SectionOutline;
    body: string;
    pageLabel: string;
}

const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

function deduplicateGeneratedSections(generated: GeneratedSection[]): GeneratedSection[] {
    const wordSets = generated.map((g) => normalizeForComparison(g.body));
    const discard = new Set<number>();

    for (let i = 0; i < generated.length; i++) {
        if (discard.has(i)) continue;
        const itemI = generated[i];
        const wordsI = wordSets[i];
        if (!itemI || !wordsI) continue;

        for (let j = i + 1; j < generated.length; j++) {
            if (discard.has(j)) continue;
            const itemJ = generated[j];
            const wordsJ = wordSets[j];
            if (!itemJ || !wordsJ) continue;

            const similarity = jaccardSimilarity(wordsI, wordsJ);
            if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
                // Scarta la sezione con contenuto più corto: assumiamo che
                // la versione più lunga/dettagliata sia quella da tenere.
                const shorterIndex = itemI.body.length <= itemJ.body.length ? i : j;
                const shorterItem = shorterIndex === i ? itemI : itemJ;
                const keptItem = shorterIndex === i ? itemJ : itemI;
                console.warn(
                    `⚠️  Contenuto quasi duplicato rilevato (similarità ${(similarity * 100).toFixed(0)}%): "${shorterItem.section.title}" scartata a favore di "${keptItem.section.title}".`,
                );
                discard.add(shorterIndex);
            }
        }
    }

    return generated.filter((_, i) => !discard.has(i));
}

// --- Main ------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);
    const jsonIndex = args.indexOf('--json');
    const outIndex = args.indexOf('--out');

    if (jsonIndex === -1 || outIndex === -1) {
        console.error(
            'Usage: npx ts-node --project scripts/tsconfig.json scripts/markdown-from-json.ts --json <path> --out <path>',
        );
        process.exit(1);
    }

    const jsonPath = args[jsonIndex + 1];
    const outPath = args[outIndex + 1];

    if (!jsonPath || !outPath) {
        console.error('Argomenti mancanti dopo --json o --out');
        process.exit(1);
    }

    if (!fs.existsSync(jsonPath)) {
        console.error(`File non trovato: ${jsonPath}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const pages: ExtractedPage[] = JSON.parse(raw);

    console.log(`Pagine da processare: ${pages.length}`);
    console.log('Fase 1/2 — identificazione dei confini di sezione...');

    const outline = await identifySections(pages);

    console.log(`Sezioni identificate: ${outline.length}`);
    outline.forEach((s) => console.log(`  - ${s.title} [p. ${s.startPage}-${s.endPage}]`));

    console.log('\nFase 2/2 — generazione markdown per ciascuna sezione...');

    const generatedSections: GeneratedSection[] = [];

    for (const [i, section] of outline.entries()) {
        console.log(`  [${i + 1}/${outline.length}] ${section.title}...`);
        const body = await generateSectionMarkdown(section, pages);
        const pageLabel =
            section.startPage === section.endPage
                ? `p. ${section.startPage}`
                : `p. ${section.startPage}-${section.endPage}`;
        generatedSections.push({ section, body: body.trim(), pageLabel });

        // pausa per evitare rate limit Gemini
        await new Promise((res) => setTimeout(res, 5000));
    }

    console.log('\nControllo duplicati (Fix B)...');
    const dedupedSections = deduplicateGeneratedSections(generatedSections);
    if (dedupedSections.length < generatedSections.length) {
        console.log(
            `  ${generatedSections.length - dedupedSections.length} sezione/i scartata/e come duplicato di contenuto.`,
        );
    } else {
        console.log('  Nessun duplicato di contenuto rilevato.');
    }

    const markdown = dedupedSections
        .map((g) => `## ${g.section.title} [${g.pageLabel}]\n\n${g.body}`)
        .join('\n\n');

    fs.writeFileSync(outPath, markdown, 'utf-8');

    // Controllo automatico di completezza (D19): non sostituisce la revisione
    // manuale, ma è un primo segnale se il markdown ha perso molto contenuto.
    const rawWordCount = pages.reduce((sum, p) => sum + countWords(p.content), 0);
    const mdWordCount = countWords(markdown);
    const ratio = rawWordCount > 0 ? (mdWordCount / rawWordCount) * 100 : 0;

    console.log(`\nParole testo grezzo: ${rawWordCount}`);
    console.log(`Parole markdown generato: ${mdWordCount}`);
    console.log(`Rapporto: ${ratio.toFixed(1)}%`);
    if (ratio < 50) {
        console.warn(
            '⚠️  Il markdown ha meno della metà delle parole del testo grezzo. Questo può essere normale (rimozione di rumore OCR, crediti, ecc.) ma è anche il pattern osservato quando vengono omesse informazioni — controlla con particolare attenzione.',
        );
    }

    console.log(`\nMarkdown scritto in: ${outPath}`);
    console.log('\n⚠️  IMPORTANTE: revisiona questo file a mano contro il PDF originale prima di procedere con ingest-pdf.ts.');
    console.log('    Cerca in particolare i commenti "<!-- OCR illeggibile -->" e verifica che nessuna regola sia stata compressa perdendo dettagli (numeri, elenchi di opzioni/bonus, eccezioni).');
    console.log('    La deduplicazione di sezioni sovrapposte/simili è automatica (vedi warning sopra), ma non è infallibile: controlla comunque se qualche argomento sembra ripetuto o, al contrario, se manca qualcosa che sospetti sia stato scartato per errore come falso duplicato.');
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});