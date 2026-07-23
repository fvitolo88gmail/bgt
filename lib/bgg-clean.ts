// lib/bgg-clean.ts
//
// Pulizia dei post forum BGG. L'API restituisce testo con entità HTML e,
// occasionalmente, un blocco <![CDATA[...]]> con embed di immagini in HTML
// non escaped. Le citazioni ("reply with quote") non usano BBCode [q][/q]
// come da documentazione BGG, ma un markup HTML proprietario:
//   <font color=#XXXXXX><div class='quote'><div class='quotetitle'>
//     <p><b>NOME wrote:</b></p></div>
//     <div class='quotebody'>TESTO CITATO</div>
//   </div></font>
//
// Le citazioni vengono RIMOSSE interamente (non convertite in testo): il
// post citato è comunque disponibile per intero come proprio post nello
// stesso thread (storage in forum_posts) — tenerlo anche come testo citato
// duplicherebbe il contenuto, e con citazioni annidate causa crescita
// incontrollata della lunghezza (verificato su dati reali in sessione).
//
// L'autore citato (extractQuotedAuthor) viene comunque estratto e
// propagato come metadato (quoted_author) — non per ricostruire un albero
// di chunk, ma come contesto informativo che il retrieval a runtime (F5)
// può usare per chiarire i collegamenti tra post quando ricostruisce un
// thread intero.

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

function stripCdataBlocks(text: string): string {
    return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, inner: string) => {
        const innerText = stripHtmlTags(inner).trim();
        return innerText.length > 0 ? innerText : '';
    });
}

function extractQuotedAuthor(text: string): string | null {
    const match = text.match(/<div class='quotetitle'><p><b>([^<]+?) wrote:<\/b><\/p><\/div>/);
    return match ? (match[1] ?? '').trim() || null : null;
}

/**
 * Rimuove i blocchi di citazione UNO STRATO ALLA VOLTA, dal più interno
 * verso l'esterno. Una singola regex non può bilanciare correttamente tag
 * annidati identici (stessa classe 'quotebody' ripetuta dentro se stessa)
 * — il pattern qui sotto matcha solo blocchi che NON contengono
 * un'ulteriore citazione al loro interno (negative lookahead), quindi ogni
 * iterazione elimina esattamente il livello più profondo rimasto.
 */
function stripQuoteBlocksIterative(text: string): string {
    const innermostQuotePattern =
        /<font color=#[0-9a-fA-F]{3,6}><div class='quote'><div class='quotetitle'><p><b>[^<]+? wrote:<\/b><\/p><\/div><div class='quotebody'>((?:(?!<div class='quote'>)[\s\S])*?)<\/div><\/div><\/font>/;

    let result = text;
    let safetyCounter = 0;
    while (innermostQuotePattern.test(result) && safetyCounter < 50) {
        result = result.replace(innermostQuotePattern, '');
        safetyCounter += 1;
    }
    return result;
}

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

export interface CleanedPost {
    bodyClean: string;
    quotedAuthor: string | null;
}

export function cleanForumBody(rawBody: string): CleanedPost {
    let text = decodeHtmlEntities(rawBody);
    text = stripCdataBlocks(text);
    const quotedAuthor = extractQuotedAuthor(text);
    text = stripQuoteBlocksIterative(text);
    text = stripHtmlTags(text);
    text = collapseWhitespace(text);
    return { bodyClean: text, quotedAuthor };
}