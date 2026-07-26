// lib/retrieval.ts

import {supabase} from './supabase';
import {geminiClient} from './gemini';
import {buildBggThreadUrl} from './bgg';
import {decodeHtmlEntities} from './bgg-clean';

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

const QUERY_ENHANCEMENT_PROMPT = (question: string) => `Sei un assistente che migliora domande su regole di giochi da tavolo per un sistema di ricerca semantica (RAG).

Domanda dell'utente: "${question}"

Compito, in un solo passaggio:
1. Identifica i concetti/meccaniche di gioco distinti coinvolti nella domanda (1 se la domanda riguarda già un solo concetto, fino a un massimo di ${MAX_QUERY_ENHANCEMENT_CONCEPTS} se ne combina diversi).
2. Per ciascun concetto, scrivi un breve paragrafo (2-4 frasi) in prosa dichiarativa e affermativa, come se fosse un estratto di un manuale di regole che risponde a quel concetto — NON una domanda, NON un elenco puntato, NON un "forse"/"probabilmente". Usa terminologia plausibile e naturale anche se non conosci quella esatta usata dal gioco specifico: è più importante lo stile dichiarativo del contenuto esatto.

Rispondi SOLO con un array JSON di stringhe (un paragrafo per concetto), nient'altro, senza backtick, senza preamboli. Esempio di formato:
["Paragrafo dichiarativo sul primo concetto...", "Paragrafo dichiarativo sul secondo concetto..."]`;

async function generateEnhancedQueries(question: string): Promise<string[]> {
    try {
        const raw = await geminiClient.generate(QUERY_ENHANCEMENT_PROMPT(question));
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
 * comunque 2 chunk manuale deboli sottrarrebbe spazio a candidati forum
 * più utili solo per riempire una quota. Soglia iniziale stimata dai dati
 * osservati in sessione (match pertinenti oggi: 65-79%; da validare
 * empiricamente con più domande/giochi, stesso spirito di S3.2).
 */
const MIN_MANUAL_CHUNKS = 2;
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
    const enhancedQueries = await generateEnhancedQueries(query);
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

    const matches = selectWithReservedBudget([...bestById.values()], topK, MIN_MANUAL_CHUNKS, MIN_MANUAL_SIMILARITY);

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