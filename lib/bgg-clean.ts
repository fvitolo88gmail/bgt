// lib/bgg-clean.ts
//
// Pulizia dei post forum BGG: l'API restituisce testo con entità HTML
// (anche quando l'XML è già stato parsato, per sicurezza le decodifichiamo
// comunque — decodificare due volte testo già pulito è un no-op) più,
// occasionalmente, un blocco <![CDATA[...]]> con embed di immagini in HTML
// non escaped (visto negli screenshot allegati ai post). Le citazioni non
// usano BBCode [q][/q] come da documentazione BGG, ma un markup HTML
// proprietario generato dal client "Reply with quote":
//   <font color=#XXXXXX><div class='quote'><div class='quotetitle'>
//     <p><b>NOME wrote:</b></p></div>
//     <div class='quotebody'>TESTO CITATO</div>
//   </div></font>

const HTML_ENTITIES: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
    return text.replace(/&lt;|&gt;|&amp;|&quot;|&#039;|&apos;|&nbsp;/g, (match) => HTML_ENTITIES[match] ?? match);
}

/**
 * Rimuove i blocchi <![CDATA[...]]>. Se contengono solo markup di embed
 * immagine (nessun testo utile dopo lo strip dei tag), il blocco viene
 * scartato interamente; altrimenti ne viene mantenuto solo il testo.
 */
function stripCdataBlocks(text: string): string {
    return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, inner: string) => {
        const innerText = stripHtmlTags(inner).trim();
        return innerText.length > 0 ? innerText : '';
    });
}

/**
 * Converte il markup di citazione BGG in un prefisso testuale esplicito,
 * es. "[citando Jeanboucher] Thank you for the clarification..."
 * Va applicato PRIMA dello strip generico dei tag, altrimenti la struttura
 * <div class='quotetitle'>/<div class='quotebody'> viene persa.
 */
function convertQuoteBlocks(text: string): string {
    const quotePattern =
        /<font color=#[0-9a-fA-F]{3,6}><div class='quote'><div class='quotetitle'><p><b>([^<]+?) wrote:<\/b><\/p><\/div><div class='quotebody'>([\s\S]*?)<\/div><\/div><\/font>/g;

    return text.replace(quotePattern, (_match, author: string, quotedRaw: string) => {
        const quotedClean = stripHtmlTags(quotedRaw).replace(/\s+/g, ' ').trim();
        return `[citando ${author.trim()}] ${quotedClean}`;
    });
}

/** Strip generico dei tag HTML residui, con newline al posto di <br/> e </p>. */
function stripHtmlTags(text: string): string {
    return text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '');
}

function collapseWhitespace(text: string): string {
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Pulisce il body grezzo di un post forum BGG in testo semplice pronto
 * per l'embedding. Non applica alcun filtro di lunghezza minima — quello
 * (D10, >50 caratteri) va applicato dal chiamante sul risultato di questa
 * funzione, non sul body grezzo.
 */
export function cleanForumBody(rawBody: string): string {
    let text = decodeHtmlEntities(rawBody);
    text = stripCdataBlocks(text);
    text = convertQuoteBlocks(text);
    text = stripHtmlTags(text);
    text = collapseWhitespace(text);
    return text;
}