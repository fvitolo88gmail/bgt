// lib/retrieval.ts

import {supabase} from './supabase';
import {geminiClient} from './gemini';
import {buildBggThreadUrl} from './bgg';
import {decodeHtmlEntities} from './bgg-clean';
import {rerankByRelevance, type RerankCandidate, type RerankScore} from './reranking';

export interface ChunkMatch {
    id: string;
    gameId: string;
    source: string;
    content: string;
    page: number | null;
    section: string | null;
    bggThreadId: number | null;
    bggArticleId: number | null;
    bggUrl: string | null; // link diretto al thread/post BGG, solo per source='forum'
    threadSubject: string | null;
    authorUsername: string | null;
    isDesignerResponse: boolean | null;
    postDate: string | null;
    similarity: number;
}

export async function matchChunks(
    query: string,
    gameId: string,
    topK: number = 5,
    filterSource?: 'manual' | 'forum',
): Promise<ChunkMatch[]> {
    const embedding = await geminiClient.embed(query);

    const {data, error} = await supabase.rpc('match_chunks', {
        query_embedding: embedding,
        match_game_id: gameId,
        match_count: topK,
        filter_source: filterSource ?? null,
    });

    if (error) {
        throw new Error(`Retrieval error: ${error.message}`);
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
        const bggThreadId = row.bgg_thread_id as number | null;
        const bggArticleId = row.bgg_article_id as number | null;
        return {
            id: row.id as string,
            gameId: row.game_id as string,
            source: row.source as string,
            content: row.content as string,
            page: row.page as number | null,
            section: row.section as string | null,
            bggThreadId,
            bggArticleId,
            bggUrl: bggThreadId != null ? buildBggThreadUrl(bggThreadId, bggArticleId) : null,
            // Decodifica difensiva: i thread ingested prima del fix in
            // lib/bgg.ts hanno subject con entità HTML grezze (es. "one&#039;s")
            // già in chunks.thread_subject — corretto qui una volta per tutte
            // le fonti a valle (contesto LLM, sourceLabel, citazioni UI), senza
            // richiedere un backfill sul DB.
            threadSubject: row.thread_subject ? decodeHtmlEntities(row.thread_subject as string) : null,
            authorUsername: row.author_username as string | null,
            isDesignerResponse: row.is_designer_response as boolean | null,
            postDate: row.post_date as string | null,
            similarity: row.similarity as number,
        };
    });
}

// --- Epica Q (0550): query enhancement — decomposizione + HyDE combinati ---
//
// Verificato manualmente in sessione (vedi decision-log): la decomposizione
// pura risolve la dilution su domande composte (concetti diversi che si
// annacquano a vicenda in un solo embedding), ma può PEGGIORARE il retrieval
// se riformulata come sotto-domanda anziché come prosa dichiarativa in stile
// manuale (HyDE) — la similarità domanda-vs-domanda tra query e thread forum
// è strutturalmente più alta di domanda-vs-prosa-dichiarativa del manuale, a
// prescindere dal contenuto. Per questo le due tecniche sono unite in un
// solo step: un unico prompt scompone la domanda in concetti distinti (1 se
// la domanda è già singola) e per ciascuno genera un breve paragrafo
// ipotetico in stile regolamento, non una sotto-domanda.
//
// Il risultato viene SEMPRE unito al retrieval sulla query originale
// (baseline), mai usato in sostituzione — rischio osservato: una
// riformulazione che si allontana dal lessico corretto del gioco può far
// perdere un chunk che il baseline grezzo trovava già.
//
// Fail-soft per design: se la generazione fallisce (quota, errore di
// parsing, ecc.) si prosegue con la sola query originale — questo step è un
// arricchimento, non deve mai far cadere l'intera risposta.

const MAX_QUERY_ENHANCEMENT_CONCEPTS = 3;

// Lingua di fallback se games.manual_language non è disponibile per qualche
// motivo (riga non trovata, query fallita) — 'en' perché è la lingua di
// tutti i manuali ingested finora (v. Epica 0551, D46). Fail-soft: meglio
// assumere inglese (spesso corretto) che bloccare l'enhancement.
const DEFAULT_MANUAL_LANGUAGE = 'en';

// QUERY_ENHANCEMENT_PROMPT ora richiede ESPLICITAMENTE la lingua del
// manuale target (Epica 0551, D46): prima non la specificava, quindi i
// paragrafi HyDE ereditavano silenziosamente la lingua della domanda
// dell'utente. Su un manuale in una lingua diversa da quella della query
// (es. manuale EN, query IT) questo annullava il vantaggio della tecnica —
// invece di avvicinare l'embedding della query al lessico del manuale, lo
// allontanava di nuovo (confronto IT-generato vs EN-del-manuale, invece di
// EN-generato vs EN-del-manuale). Verificato con
// scripts/diagnostics/diagnose-query-enhancement.ts su Hegemony (manuale
// EN, query IT): paragrafi generati in italiano prima di questo fix.
const QUERY_ENHANCEMENT_PROMPT = (question: string, manualLanguage: string) => `Sei un assistente che migliora domande su regole di giochi da tavolo per un sistema di ricerca semantica (RAG).

Domanda dell'utente: "${question}"

Il manuale del gioco su cui verrà eseguita la ricerca è scritto in lingua "${manualLanguage}" (codice ISO 639-1). La domanda dell'utente può essere in una lingua diversa.

Compito, in un solo passaggio:
1. Identifica i concetti/meccaniche di gioco distinti coinvolti nella domanda (1 se la domanda riguarda già un solo concetto, fino a un massimo di ${MAX_QUERY_ENHANCEMENT_CONCEPTS} se ne combina diversi).
2. Per ciascun concetto, scrivi un breve paragrafo (2-4 frasi) in prosa dichiarativa e affermativa, come se fosse un estratto di un manuale di regole che risponde a quel concetto — NON una domanda, NON un elenco puntato, NON un "forse"/"probabilmente". Usa terminologia plausibile e naturale anche se non conosci quella esatta usata dal gioco specifico: è più importante lo stile dichiarativo del contenuto esatto.
3. IMPORTANTE: scrivi ogni paragrafo nella lingua "${manualLanguage}" (la lingua del manuale), NON nella lingua della domanda dell'utente. L'obiettivo è avvicinare il testo generato al lessico reale del manuale, che è in quella lingua.

Rispondi SOLO con un array JSON di stringhe (un paragrafo per concetto, nella lingua "${manualLanguage}"), nient'altro, senza backtick, senza preamboli. Esempio di formato:
["Paragrafo dichiarativo sul primo concetto...", "Paragrafo dichiarativo sul secondo concetto..."]`;

// Esportata (non solo uso interno) per permettere la diagnostica isolata
// del solo step di query enhancement, senza dover rieseguire l'intero
// retrieval — v. scripts/diagnostics/diagnose-query-enhancement.ts
// (sessione 2026-07-27, verifica ipotesi lingua HyDE).
export async function generateEnhancedQueries(
    question: string,
    manualLanguage: string = DEFAULT_MANUAL_LANGUAGE,
): Promise<string[]> {
    try {
        const raw = await geminiClient.generate(QUERY_ENHANCEMENT_PROMPT(question, manualLanguage));
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((s) => typeof s === 'string')) {
            throw new Error('formato risposta inatteso');
        }
        return parsed as string[];
    } catch (err) {
        console.error('[retrieval] query enhancement fallita, procedo con la sola query originale:', err);
        return [];
    }
}

// --- F5: retrieval multi-fonte con espansione thread forum (small-to-big) ---

export interface ExpandedForumPost {
    bggArticleId: number;
    authorUsername: string;
    postDate: string | null;
    isDesignerResponse: boolean;
    url: string;
}

export interface PromptChunk {
    content: string;
    sourceLabel: string;
    url?: string | null; // link diretto BGG, solo per chunk source='forum'
    posts?: ExpandedForumPost[]; // presente solo se il chunk è un thread forum espanso (F5)
}

export interface RetrievalResult {
    context: PromptChunk[];
    sources: ChunkMatch[]; // i match ORIGINALI, non espansi — per la UI/citazioni
}

interface ForumPostRow {
    bgg_article_id: number;
    author_username: string;
    quoted_author: string | null;
    post_date: string | null;
    body_clean: string;
    is_designer_response: boolean;
}

interface ExpandedThread {
    content: string;
    posts: ExpandedForumPost[];
}

async function expandForumThread(
    gameId: string,
    bggThreadId: number,
    threadSubject: string,
): Promise<ExpandedThread> {
    const { data, error } = await supabase
        .from('forum_posts')
        .select('bgg_article_id, author_username, quoted_author, post_date, body_clean, is_designer_response')
        .eq('game_id', gameId)
        .eq('bgg_thread_id', bggThreadId)
        .order('post_date', { ascending: true });

    if (error) {
        throw new Error(`Errore espandendo thread ${bggThreadId}: ${error.message}`);
    }

    const rows = (data ?? []) as ForumPostRow[];

    const segments = rows.map((post) => {
        const replyTag = post.quoted_author ? ` [in risposta a: ${post.quoted_author}]` : '';
        const designerTag = post.is_designer_response ? ' [DESIGNER UFFICIALE DEL GIOCO]' : '';
        const postUrl = buildBggThreadUrl(bggThreadId, post.bgg_article_id);
        return `[Autore: ${post.author_username}${designerTag}]${replyTag} [URL: ${postUrl}] [Data: ${post.post_date ?? ''}]\n${post.body_clean}`;
    });

    const posts: ExpandedForumPost[] = rows.map((post) => ({
        bggArticleId: post.bgg_article_id,
        authorUsername: post.author_username,
        postDate: post.post_date,
        isDesignerResponse: post.is_designer_response,
        url: buildBggThreadUrl(bggThreadId, post.bgg_article_id),
    }));

    return {
        content: `[Thread: ${threadSubject}]\n\n${segments.join('\n\n---\n\n')}`,
        posts,
    };
}

/**
 * Budget riservato per fonte (sessione diagnostica Hegemony, in attesa di
 * numero decision-log): senza questo, il merge globale per similarità può
 * far sì che più thread forum sullo stesso argomento (comune quando un
 * argomento è molto discusso sul forum) affollino il topK e spingano fuori
 * l'UNICO chunk manuale pertinente — la fonte più autorevole e completa,
 * ma strutturalmente "in minoranza numerica" contro N thread forum simili.
 * Verificato: domanda su Hegemony (Middle Class "buy from itself") con
 * chunk manuale a similarità 68.6% esclusa dal contesto finale a favore di
 * 4 chunk forum su varianti dello stesso argomento.
 *
 * Il budget scatta SOLO se il chunk manuale ha una similarità minima
 * ragionevole (MIN_MANUAL_SIMILARITY) — altrimenti, su una domanda per
 * cui il manuale non ha davvero nulla di pertinente (es. domanda
 * fuori-scope, o specifica del forum come una FAQ community), forzare
 * comunque 4 chunk manuale deboli sottrarrebbe spazio a candidati forum
 * più utili solo per riempire una quota. Soglia iniziale stimata dai dati
 * osservati in sessione (match pertinenti oggi: 65-79%; da validare
 * empiricamente con più domande/giochi, stesso spirito di S3.2).
 *
 * MIN_MANUAL_CHUNKS alzato da 2 a 4 (sessione 2026-07-27, v. decision-log):
 * diagnosticato un caso (Hegemony, domanda su beni di magazzino/Classe
 * Media) in cui la regola corretta viveva in un chunk manuale con
 * similarità grezza più bassa (embedding "diluito" da una sezione con più
 * azioni eterogenee) rispetto ad altri due chunk manuale più generici ma
 * meno risolutivi — con MIN_MANUAL_CHUNKS=2 quei due generici esaurivano
 * la riserva e il chunk corretto restava fuori dal contesto finale anche
 * con query enhancement attivo. La similarità cross-lingua (query IT su
 * manuale EN) osservata in questo progetto ha un margine stretto (~65-79%
 * tra chunk pertinenti e marginali): un cutoff stretto su un segnale così
 * debole scarta chunk validi per differenze di 1-2 punti percentuali non
 * significative. Fix generalizzato (non specifico a Hegemony): più
 * budget di recall lato manuale, non un chunking ad hoc per un singolo
 * gioco.
 *
 * Alzato ulteriormente da 4 a 6 (sessione 2026-07-28, D51, dopo il fix di
 * chunking fine-grained di 0560 punto 3/D50): il re-chunking ha già
 * risolto la maggior parte del problema da solo — "Classe Media — Buy
 * Goods & Services" è salito da ~69% a 72.7% (4° posto tra i soli chunk
 * manuale), ma restava appena fuori dalla riserva a causa di 5 chunk
 * "Cover Needs" quasi-duplicati (uno per ruolo: Classe Media, Classe
 * Lavoratrice, Classe Capitalista, Lo Stato, Regole Generali) che si
 * affollano nella parte alta della classifica invece di lasciare spazio a
 * diversità. A differenza dell'alzata precedente (segnale strutturalmente
 * troppo debole per qualunque soglia), qui il margine è stretto (72.7%
 * contro 74.5% del primo) — un aggiustamento fine, non una toppa alla
 * cieca. Nota per il futuro: la ridondanza dei chunk "Cover Needs" per
 * ruolo è essa stessa un problema di rumore da tenere d'occhio (0561,
 * reranking, la affronterebbe meglio di un ulteriore alzamento di soglia).
 */
const MIN_MANUAL_CHUNKS = 6;
const MIN_MANUAL_SIMILARITY = 0.4;

function selectWithReservedBudget(
    allMatches: ChunkMatch[],
    topK: number,
    minManual: number,
    minManualSimilarity: number,
): ChunkMatch[] {
    const sorted = [...allMatches].sort((a, b) => b.similarity - a.similarity);
    const manualSorted = sorted.filter(
        (m) => m.source === 'manual' && m.similarity >= minManualSimilarity,
    );

    const selected: ChunkMatch[] = [];
    const selectedIds = new Set<string>();

    for (const m of manualSorted.slice(0, minManual)) {
        selected.push(m);
        selectedIds.add(m.id);
    }

    for (const m of sorted) {
        if (selected.length >= topK) break;
        if (selectedIds.has(m.id)) continue;
        selected.push(m);
        selectedIds.add(m.id);
    }

    return selected.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}

// Legge games.manual_language (Epica 0551, L1) per parametrizzare la lingua
// di output di generateEnhancedQueries. Fail-soft per design, come il resto
// del query enhancement: un errore qui non deve mai far fallire l'intero
// retrieval — se la lettura fallisce o il campo è vuoto, si assume
// DEFAULT_MANUAL_LANGUAGE ('en', la lingua di tutti i manuali ingested
// finora) invece di bloccare la richiesta.
async function fetchManualLanguage(gameId: string): Promise<string> {
    const { data, error } = await supabase
        .from('games')
        .select('manual_language')
        .eq('id', gameId)
        .single();

    if (error || !data?.manual_language) {
        console.error(`[retrieval] impossibile leggere manual_language per game ${gameId}, uso default '${DEFAULT_MANUAL_LANGUAGE}':`, error?.message);
        return DEFAULT_MANUAL_LANGUAGE;
    }

    return data.manual_language as string;
}

// Epica 0561 (R1, D52): tetto al numero di candidati mandati al reranker,
// indipendentemente da quanti ne produce il merge multi-query — limita
// costo/dimensione del prompt di reranking in modo prevedibile. I migliori
// per similarità grezza entrano per primi (il reranker giudica pertinenza,
// non deve ri-scoprire candidati che il retrieval ha già scartato).
const RERANK_POOL_CAP = 30;

/**
 * Seleziona i topK finali per punteggio di pertinenza (reranking), non più
 * per similarità grezza. Sostituisce selectWithReservedBudget quando il
 * reranking ha successo — un giudizio di pertinenza reale non ha bisogno
 * della riserva a soglia fissa per fonte, che esisteva solo per compensare
 * il segnale debole della sola similarità (v. D38, D46-D51). Candidati non
 * scored dal reranker (risposta malformata parziale) sono trattati come
 * peggiori di qualunque candidato scored, non esclusi silenziosamente.
 */
function selectByRerankScore(
    candidates: ChunkMatch[],
    scores: RerankScore[],
    topK: number,
): ChunkMatch[] {
    const scoreById = new Map(scores.map((s) => [s.id, s.score]));
    return [...candidates]
        .sort((a, b) => (scoreById.get(b.id) ?? -1) - (scoreById.get(a.id) ?? -1))
        .slice(0, topK);
}

/**
 * Retrieval per il prompt (F5, small-to-big + Epica Q query enhancement).
 * Cerca su ENTRAMBE le fonti. La query viene arricchita con paragrafi
 * decomposti+HyDE (vedi generateEnhancedQueries), e il risultato è
 * l'unione deduplicata (per chunk id, tenendo la similarità più alta) di:
 *   - retrieval sulla query originale (baseline, sempre incluso)
 *   - retrieval su ciascun paragrafo generato
 * La selezione finale riserva un budget minimo al manuale (vedi
 * selectWithReservedBudget) prima di riempire il resto per similarità
 * globale, così l'unica fonte manuale non viene sistematicamente
 * schiacciata da più thread forum sullo stesso argomento.
 * Per ogni chunk source='forum' vincente nell'insieme finale, espande
 * SEMPRE l'intero thread da forum_posts. I chunk source='manual' passano
 * invariati. `sources` mantiene i match finali (non espansi) per le
 * citazioni mostrate in UI.
 */
export async function matchChunksForPrompt(
    query: string,
    gameId: string,
    topK: number = 5,
): Promise<RetrievalResult> {
    const manualLanguage = await fetchManualLanguage(gameId);
    const enhancedQueries = await generateEnhancedQueries(query, manualLanguage);
    const searchQueries = [query, ...enhancedQueries];

    // Fetch separato per fonte, per ogni query (originale + arricchite): un
    // pool ampio per lato (RAW_CANDIDATES_PER_SOURCE > topK finale) evita che
    // il forum "saturi" già a questo stadio il top-K misto di una singola
    // query, escludendo un chunk manuale pertinente prima ancora che la
    // selezione finale (selectWithReservedBudget) abbia la possibilità di
    // intervenire. Verificato: bug osservato dove un chunk manuale al 2°
    // posto tra i soli candidati manuale non arrivava comunque al contesto
    // finale, perché non sopravviveva al top-5 misto per-query a monte.
    const RAW_CANDIDATES_PER_SOURCE = 8;

    const settled = await Promise.allSettled(
        searchQueries.flatMap((q) => [
            matchChunks(q, gameId, RAW_CANDIDATES_PER_SOURCE, 'manual'),
            matchChunks(q, gameId, RAW_CANDIDATES_PER_SOURCE, 'forum'),
        ]),
    );

    const matchLists: ChunkMatch[][] = [];
    settled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            matchLists.push(result.value);
        } else {
            console.error(`[retrieval] retrieval fallito per la query arricchita #${i}:`, result.reason);
        }
    });

    if (matchLists.length === 0) {
        throw new Error('Retrieval fallito su tutte le query, inclusa quella originale');
    }

    // Merge deduplicato per id, tenendo la similarità più alta osservata
    // tra tutte le query (originale + arricchite) per quel chunk.
    const bestById = new Map<string, ChunkMatch>();
    for (const list of matchLists) {
        for (const match of list) {
            const existing = bestById.get(match.id);
            if (!existing || match.similarity > existing.similarity) {
                bestById.set(match.id, match);
            }
        }
    }

    // Epica 0561 (R1, D52): reranking sulla domanda ORIGINALE (non
    // arricchita) come criterio di selezione primario. Il pool è tagliato
    // a RERANK_POOL_CAP per similarità grezza prima di essere mandato al
    // reranker — i migliori candidati "grezzi" restano la base, il
    // reranking ne giudica la pertinenza reale invece di riscoprirli da
    // zero. Fail-soft: se il reranking fallisce (errore rete/parsing),
    // si ricade sulla selezione a riserva per similarità (comportamento
    // pre-0561, invariato).
    const pooled = [...bestById.values()]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, RERANK_POOL_CAP);

    const rerankCandidates: RerankCandidate[] = pooled.map((m) => ({
        id: m.id,
        label: m.source === 'manual'
            ? (m.section ?? 'Manuale')
            : `Forum — ${m.threadSubject ?? 'n/d'}`,
        content: m.content,
    }));

    const rerankScores = await rerankByRelevance(query, rerankCandidates);

    const matches = rerankScores
        ? selectByRerankScore(pooled, rerankScores, topK)
        : selectWithReservedBudget(pooled, topK, MIN_MANUAL_CHUNKS, MIN_MANUAL_SIMILARITY);

    const context: PromptChunk[] = [];
    const expandedThreadIds = new Set<number>();

    for (const match of matches) {
        if (match.source === 'manual') {
            const label = match.section ?? (match.page !== null ? `Pagina ${match.page}` : 'Manuale');
            context.push({content: match.content, sourceLabel: label});
            continue;
        }

        if (match.bggThreadId === null) {
            context.push({
                content: match.content,
                sourceLabel: match.threadSubject ?? 'Forum',
                url: match.bggUrl,
            });
            continue;
        }

        if (expandedThreadIds.has(match.bggThreadId)) continue; // già espanso da un match precedente dello stesso thread
        expandedThreadIds.add(match.bggThreadId);

        const expanded = await expandForumThread(gameId, match.bggThreadId, match.threadSubject ?? '');
        context.push({
            content: expanded.content,
            sourceLabel: `Forum — Thread: ${match.threadSubject ?? ''}`,
            url: buildBggThreadUrl(match.bggThreadId), // link alla radice del thread
            posts: expanded.posts,
        });
    }

    return {context, sources: matches};
}