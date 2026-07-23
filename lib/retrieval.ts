// lib/retrieval.ts

import {supabase} from './supabase';
import {geminiClient} from './gemini';

export interface ChunkMatch {
    id: string;
    gameId: string;
    source: string;
    content: string;
    page: number | null;
    section: string | null;
    bggThreadId: number | null;
    bggArticleId: number | null;
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

    return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        gameId: row.game_id as string,
        source: row.source as string,
        content: row.content as string,
        page: row.page as number | null,
        section: row.section as string | null,
        bggThreadId: row.bgg_thread_id as number | null,
        bggArticleId: row.bgg_article_id as number | null,
        threadSubject: row.thread_subject as string | null,
        authorUsername: row.author_username as string | null,
        isDesignerResponse: row.is_designer_response as boolean | null,
        postDate: row.post_date as string | null,
        similarity: row.similarity as number,
    }));
}

// --- F5: retrieval multi-fonte con espansione thread forum (small-to-big) ---

export interface PromptChunk {
    content: string;
    sourceLabel: string;
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

async function expandForumThread(
    gameId: string,
    bggThreadId: number,
    threadSubject: string,
): Promise<string> {
    const { data, error } = await supabase
        .from('forum_posts')
        .select('bgg_article_id, author_username, quoted_author, post_date, body_clean, is_designer_response')
        .eq('game_id', gameId)
        .eq('bgg_thread_id', bggThreadId)
        .order('post_date', { ascending: true });

    if (error) {
        throw new Error(`Errore espandendo thread ${bggThreadId}: ${error.message}`);
    }

    const posts = (data ?? []) as ForumPostRow[];
    const segments = posts.map((post) => {
        const replyTag = post.quoted_author ? ` [in risposta a: ${post.quoted_author}]` : '';
        const designerTag = post.is_designer_response ? ' [DESIGNER UFFICIALE DEL GIOCO]' : '';
        return `[Autore: ${post.author_username}${designerTag}]${replyTag} [Data: ${post.post_date ?? ''}]\n${post.body_clean}`;
    });

    return `[Thread: ${threadSubject}]\n\n${segments.join('\n\n---\n\n')}`;
}

/**
 * Retrieval per il prompt (F5, small-to-big). Cerca su ENTRAMBE le fonti
 * (nessun filtro source di default — prima era hardcoded solo 'manual' in
 * app/api/chat/route.ts). Per ogni chunk source='forum' vincente, espande
 * SEMPRE l'intero thread da forum_posts (nessun filtro/tetto aggiuntivo —
 * deciso in sessione, i thread grandi e pertinenti sono rari, ~1% su
 * Brass). I chunk source='manual' passano invariati. `sources` mantiene i
 * match originali (non espansi) per le citazioni mostrate in UI.
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
            context.push({content: match.content, sourceLabel: match.threadSubject ?? 'Forum'});
            continue;
        }

        if (expandedThreadIds.has(match.bggThreadId)) continue; // già espanso da un match precedente dello stesso thread
        expandedThreadIds.add(match.bggThreadId);

        const expandedContent = await expandForumThread(gameId, match.bggThreadId, match.threadSubject ?? '');
        const designerNote = match.isDesignerResponse ? ' — include una risposta del designer' : '';
        context.push({
            content: expandedContent,
            sourceLabel: `Forum — Thread: ${match.threadSubject ?? ''}`,
        });
    }

    return {context, sources: matches};
}