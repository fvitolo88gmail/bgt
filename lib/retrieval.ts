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

async function queryChunksByEmbedding(
    embedding: number[],
    gameId: string,
    topK: number,
    filterSource?: 'manual' | 'forum',
): Promise<ChunkMatch[]> {
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
            // Decodifica difensiva: alcuni subject nel DB hanno entità HTML
            // grezze (es. "one&#039;s") — corretto qui invece che con un
            // backfill sul DB.
            threadSubject: row.thread_subject ? decodeHtmlEntities(row.thread_subject as string) : null,
            authorUsername: row.author_username as string | null,
            isDesignerResponse: row.is_designer_response as boolean | null,
            postDate: row.post_date as string | null,
            similarity: row.similarity as number,
        };
    });
}

/**
 * Esportata anche per uso standalone (es. scripts/test-decomposition.ts):
 * embed della query seguito dalla ricerca. matchChunksForPrompt usa invece
 * queryChunksByEmbedding direttamente, per riusare lo stesso embedding tra
 * la ricerca manuale e quella forum sulla stessa query.
 */
export async function matchChunks(
    query: string,
    gameId: string,
    topK: number = 5,
    filterSource?: 'manual' | 'forum',
): Promise<ChunkMatch[]> {
    const embedding = await geminiClient.embed(query);
    return queryChunksByEmbedding(embedding, gameId, topK, filterSource);
}

// Query enhancement: decomposizione + HyDE in un solo step. La
// decomposizione pura aiuta sulle domande composte, ma riformulare come
// sotto-domanda peggiora il retrieval (la similarità domanda-vs-domanda con
// i thread forum è strutturalmente più alta di domanda-vs-prosa del
// manuale, a prescindere dal contenuto) — per questo ogni concetto genera
// un paragrafo dichiarativo in stile regolamento, non una sotto-domanda.
// Il risultato si somma SEMPRE alla query originale, mai la sostituisce.
// Fail-soft: se la generazione fallisce si prosegue con la sola query
// originale.

const MAX_QUERY_ENHANCEMENT_CONCEPTS = 3;

// 'en': lingua di tutti i manuali ingested finora. Fail-soft se
// games.manual_language non è leggibile.
const DEFAULT_MANUAL_LANGUAGE = 'en';

// La lingua del manuale va specificata esplicitamente: altrimenti i
// paragrafi HyDE ereditano la lingua della domanda, vanificando il
// vantaggio della tecnica su un manuale in lingua diversa.
const QUERY_ENHANCEMENT_PROMPT = (question: string, manualLanguage: string) => `Sei un assistente che migliora domande su regole di giochi da tavolo per un sistema di ricerca semantica (RAG).

Domanda dell'utente: "${question}"

Il manuale del gioco su cui verrà eseguita la ricerca è scritto in lingua "${manualLanguage}" (codice ISO 639-1). La domanda dell'utente può essere in una lingua diversa.

Compito, in un solo passaggio:
1. Identifica i concetti/meccaniche di gioco distinti coinvolti nella domanda (1 se la domanda riguarda già un solo concetto, fino a un massimo di ${MAX_QUERY_ENHANCEMENT_CONCEPTS} se ne combina diversi).
2. Per ciascun concetto, scrivi un breve paragrafo (2-4 frasi) in prosa dichiarativa e affermativa, come se fosse un estratto di un manuale di regole che risponde a quel concetto — NON una domanda, NON un elenco puntato, NON un "forse"/"probabilmente". Usa terminologia plausibile e naturale anche se non conosci quella esatta usata dal gioco specifico: è più importante lo stile dichiarativo del contenuto esatto.
3. IMPORTANTE: scrivi ogni paragrafo nella lingua "${manualLanguage}" (la lingua del manuale), NON nella lingua della domanda dell'utente. L'obiettivo è avvicinare il testo generato al lessico reale del manuale, che è in quella lingua.

Rispondi SOLO con un array JSON di stringhe (un paragrafo per concetto, nella lingua "${manualLanguage}"), nient'altro, senza backtick, senza preamboli. Esempio di formato:
["Paragrafo dichiarativo sul primo concetto...", "Paragrafo dichiarativo sul secondo concetto..."]`;

// Esportata per permettere di testare questo step in isolamento (v.
// scripts/diagnostics/diagnose-query-enhancement.ts).
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

// --- Retrieval multi-fonte con espansione thread forum (small-to-big) ---

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
    posts?: ExpandedForumPost[]; // presente solo se il chunk è un thread forum espanso
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
 * Budget riservato per fonte: senza questo, più thread forum sullo stesso
 * argomento possono affollare il topK e spingere fuori l'unico chunk
 * manuale pertinente, più autorevole ma numericamente in minoranza. Scatta
 * solo se il chunk manuale supera MIN_MANUAL_SIMILARITY, per non forzare
 * chunk deboli quando il manuale non ha davvero nulla di pertinente.
 * Usato solo come fallback quando il reranking (sotto) fallisce.
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

// Fail-soft: un errore qui non deve mai bloccare il retrieval.
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

// Tetto al numero di candidati mandati al reranker, per limitare
// costo/dimensione del prompt in modo prevedibile.
const RERANK_POOL_CAP = 30;

/**
 * Seleziona i topK finali per punteggio di pertinenza (reranking), non più
 * per similarità grezza. Candidati non scored dal reranker sono trattati
 * come peggiori di qualunque candidato scored, non esclusi silenziosamente.
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
 * Retrieval per il prompt: cerca su entrambe le fonti (manuale e forum),
 * arricchendo la query con paragrafi decomposti+HyDE (vedi
 * generateEnhancedQueries) e unendo i risultati per chunk id (tenendo la
 * similarità più alta). Il pool viene poi riordinato per pertinenza reale
 * (reranking), con fallback alla riserva per similarità se fallisce.
 * Per ogni chunk forum vincente espande l'intero thread da forum_posts;
 * i chunk manuale passano invariati. `sources` mantiene i match finali
 * (non espansi) per le citazioni in UI.
 */
export async function matchChunksForPrompt(
    query: string,
    gameId: string,
    topK: number = 5,
): Promise<RetrievalResult> {
    const manualLanguage = await fetchManualLanguage(gameId);
    const enhancedQueries = await generateEnhancedQueries(query, manualLanguage);
    const searchQueries = [query, ...enhancedQueries];

    // Fetch separato per fonte, per ogni query: un pool ampio per lato evita
    // che il forum saturi già a questo stadio il risultato misto di una
    // singola query, escludendo un chunk manuale pertinente prima che la
    // selezione finale possa intervenire.
    const RAW_CANDIDATES_PER_SOURCE = 8;

    // Un solo embed per query, riusato per la ricerca manuale e quella
    // forum: prima venivano fatte due chiamate embed identiche (una per
    // matchChunks 'manual', una per 'forum'), raddoppiando inutilmente le
    // chiamate Gemini per domanda.
    const embeddingResults = await Promise.allSettled(
        searchQueries.map((q) => geminiClient.embed(q)),
    );

    const rpcSettled = await Promise.allSettled(
        embeddingResults.flatMap((result) => {
            if (result.status !== 'fulfilled') return [];
            const embedding = result.value;
            return [
                queryChunksByEmbedding(embedding, gameId, RAW_CANDIDATES_PER_SOURCE, 'manual'),
                queryChunksByEmbedding(embedding, gameId, RAW_CANDIDATES_PER_SOURCE, 'forum'),
            ];
        }),
    );

    const matchLists: ChunkMatch[][] = [];
    embeddingResults.forEach((result, i) => {
        if (result.status !== 'fulfilled') {
            console.error(`[retrieval] embed fallito per la query arricchita #${i}:`, result.reason);
        }
    });
    rpcSettled.forEach((result) => {
        if (result.status === 'fulfilled') {
            matchLists.push(result.value);
        } else {
            console.error('[retrieval] ricerca fallita per una fonte:', result.reason);
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

    // Reranking sulla domanda originale (non arricchita) come criterio di
    // selezione primario, su un pool tagliato per similarità grezza.
    // Fail-soft: se fallisce si ricade sulla riserva per similarità.
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
            // La pagina va sempre inclusa insieme alla sezione quando disponibile,
            // non solo come fallback: altrimenti il numero di pagina non arriva mai
            // al modello per il caso comune (chunk con sezione), nonostante
            // CITATION_FORMAT_RULES lo preveda esplicitamente nelle citazioni.
            const sectionPart = match.section ?? 'Manuale';
            const label = match.page !== null ? `${sectionPart}, pagina ${match.page}` : sectionPart;
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
            // Link diretto al post effettivamente recuperato (la radice del
            // thread, l'unica embeddata), non alla pagina generica del thread:
            // match.bggUrl include già il bggArticleId corretto.
            url: match.bggUrl,
            posts: expanded.posts,
        });
    }

    return {context, sources: matches};
}