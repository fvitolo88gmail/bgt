import { generateFromPdfBase64 } from '@/lib/shared/gemini';
import { extractPdfPagesAsBase64, logicalRangeToPhysicalPages } from './pdf-utils';
import type { ExtractedPage, SectionOutline } from './types';

const SECTION_PROMPT_VISION = `Sei un assistente di formattazione. Il tuo unico compito è trascrivere in Markdown leggibile UNA sezione di un manuale di regole di un gioco da tavolo, guardando direttamente le pagine PDF allegate.

REGOLE FERREE — la violazione di una qualsiasi di queste rende il tuo output inutilizzabile:
0. MANTIENI SEMPRE la lingua originale del testo nel PDF. Queste istruzioni sono in italiano solo per tua comprensione — NON tradurre il contenuto. Se il manuale è in inglese, il markdown deve essere in inglese, integralmente.
1. Se scrivi sottosezioni interne, usa SEMPRE "###" o più profondo, MAI "##" né "#" — quei livelli sono riservati al titolo della sezione, aggiunto automaticamente dal codice chiamante e che tu NON devi scrivere.
2. NON correggere, dedurre, riformulare, riassumere o interpretare il contenuto delle regole. Resta il più vicino possibile alla formulazione letterale.
3. NON aggiungere informazioni non esplicitamente presenti nelle pagine.
4. NON omettere NULLA che contenga un numero, un vincolo, un'eccezione, o un elenco di opzioni/bonus.
5. NON accorciare frasi con più condizioni in sequenza in un'unica frase generica.
6. Le pagine allegate potrebbero contenere anche contenuto marginale di sezioni adiacenti per motivi di impaginazione fisica: includi SOLO quanto pertinente a questa sezione, ma non perdere alcun dettaglio della sezione stessa.
7. Se elementi visivi (icone, simboli, diagrammi) veicolano informazione non traducibile in testo puro, DESCRIVILA in prosa nel modo più fedele possibile invece di ometterla o di inventare testo segnaposto — ora che vedi le pagine reali, questo dovrebbe essere raro ma possibile.
8. Se una parte è illeggibile anche guardando la pagina reale, NON provare a indovinare: lasciala così e aggiungi <!-- illeggibile, verificare manualmente --> subito prima.

Restituisci ESCLUSIVAMENTE il contenuto Markdown della sezione (senza l'header di livello 2, verrà aggiunto separatamente), senza premessa, spiegazioni, o blocchi di codice attorno.`;

export async function generateSectionMarkdownFromPdf(
    section: SectionOutline,
    pages: ExtractedPage[],
    pdfPath: string,
    manualLanguage: string = 'inglese',
): Promise<string> {
    const physicalPages = logicalRangeToPhysicalPages(pages, section.startPage, section.endPage);
    if (physicalPages.length === 0) {
        throw new Error(`Nessuna pagina fisica trovata per la sezione "${section.title}" [p. ${section.startPage}-${section.endPage}]`);
    }

    const pdfBase64 = await extractPdfPagesAsBase64(pdfPath, physicalPages);
    const languageUpper = manualLanguage.toUpperCase();
    const prompt = `${SECTION_PROMPT_VISION}\n\nSEZIONE DA TRASCRIVERE: ${section.title}\n\nRICORDA: il manuale è in ${languageUpper}. Scrivi OGNI PAROLA del tuo output in ${manualLanguage}, comprese le frasi descrittive che scrivi tu stesso — non solo le etichette copiate dalle pagine. Zero parole in una lingua diversa da ${manualLanguage} nel markdown restituito, a parte eventuali nomi propri.`;
    return generateFromPdfBase64(prompt, pdfBase64);
}