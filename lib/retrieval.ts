// lib/retrieval.ts

import {supabase} from './supabase';
import {geminiClient} from './gemini';
import {buildBggThreadUrl} from './bgg';

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
            threadSubject: row.thread_subject as string | null,
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
 * Retrieval per il prompt (F5, small-to-big + Epica Q query enhancement).
 * Cerca su ENTRAMBE le fonti. La query viene arricchita con paragrafi
 * decomposti+HyDE (vedi generateEnhancedQueries), e il risultato è
 * l'unione deduplicata (per chunk id, tenendo la similarità più alta) di:
 *   - retrieval sulla query originale (baseline, sempre incluso)
 *   - retrieval su ciascun paragrafo generato
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

    const settled = await Promise.allSettled(
        searchQueries.map((q) => matchChunks(q, gameId, topK)),
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

    const matches = [...bestById.values()]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

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