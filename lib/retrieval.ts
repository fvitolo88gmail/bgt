import { supabase } from './supabase';
import { geminiClient } from './gemini';

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

    const { data, error } = await supabase.rpc('match_chunks', {
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