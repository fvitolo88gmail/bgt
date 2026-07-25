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

    // Ogni segmento porta il proprio URL inline ([URL: ...]) — così il
    // modello può citare il link esatto del post che sta riportando,
    // non solo un link generico alla radice del thread. Vedi buildPrompt
    // in lib/prompt.ts per le istruzioni che dicono al modello di usarlo.
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
 * Retrieval per il prompt (F5, small-to-big). Cerca su ENTRAMBE le fonti
 * (nessun filtro source di default — prima era hardcoded solo 'manual' in
 * app/api/chat/route.ts). Per ogni chunk source='forum' vincente, espande
 * SEMPRE l'intero thread da forum_posts (nessun filtro/tetto aggiuntivo —
 * deciso in sessione, i thread grandi e pertinenti sono rari, ~1% su
 * Brass). I chunk source='manual' passano invariati. `sources` mantiene i
 * match originali (non espansi) per le citazioni mostrate in UI.
 *
 * Ogni PromptChunk di fonte forum porta anche `url` (link al thread/post
 * radice) e, se espanso, `posts` con il link diretto a ciascun post del
 * thread — la UI può linkare il post esatto, non solo l'inizio del
 * thread. Nel `content` stesso, ogni post espanso porta anche il proprio
 * [URL: ...] inline, in modo che il modello possa citarlo direttamente
 * nel testo della risposta (vedi lib/prompt.ts).
 */
export async function matchChunksForPrompt(
    query: string,
    gameId: string,
    topK: number = 5,
): Promise<RetrievalResult> {
    const matches = await matchChunks(query, gameId, topK); // nessun filterSource → entrambe le fonti

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