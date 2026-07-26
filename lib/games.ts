/**
 * Verifiche di coerenza sull'identità di un gioco tra le sue rappresentazioni
 * parallele: slug su filesystem (ingest/{slug}/...), bggId nei dati BGG
 * locali (discover.json/posts.json), game_id in Supabase.
 *
 * Gli script di ingest forum (forum-ingest.ts, sync-forum.ts) ricevono
 * --game-slug e --game-id come flag CLI indipendenti, senza alcun legame
 * strutturale tra i due. Senza una verifica esplicita, un mismatch (es. slug
 * di un gioco passato insieme all'id di un altro) scriverebbe silenziosamente
 * i dati forum del gioco sbagliato sotto il game_id sbagliato — corruzione
 * silenziosa, visibile solo a posteriori nelle risposte in chat.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export class GameIdentityMismatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GameIdentityMismatchError';
    }
}

/**
 * Verifica che `gameId` corrisponda al gioco con `expectedBggId` (letto da
 * discover.json/posts.json, cioè legato allo slug su cui si sta operando).
 * Va chiamata PRIMA di qualunque scrittura su forum_threads/forum_posts/chunks.
 *
 * Lancia GameIdentityMismatchError se il gioco non esiste in `games` o se il
 * suo bgg_id non coincide con quello atteso.
 */
export async function verifyGameIdentity(
    supabase: SupabaseClient,
    gameId: string,
    expectedBggId: number
): Promise<void> {
    const { data, error } = await supabase
        .from('games')
        .select('bgg_id, name')
        .eq('id', gameId)
        .maybeSingle();

    if (error) {
        throw new GameIdentityMismatchError(
            `Errore verificando games.id=${gameId}: ${error.message}`
        );
    }
    if (!data) {
        throw new GameIdentityMismatchError(`Nessun gioco trovato in games con id=${gameId}`);
    }
    if (data.bgg_id !== expectedBggId) {
        throw new GameIdentityMismatchError(
            `Mismatch slug/game-id: games.id=${gameId} ha bgg_id=${data.bgg_id} ("${data.name}"), ` +
                `ma i dati locali (slug) si riferiscono a bggId=${expectedBggId}. ` +
                `Controlla i flag --game-slug e --game-id passati allo script.`
        );
    }
}
