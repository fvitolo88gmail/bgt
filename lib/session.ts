/**
 * Il session id è generato lato client (un id nuovo a ogni apertura di
 * /game/[id]), non recuperato per game_id: altrimenti ogni apertura della
 * chat per lo stesso gioco condividerebbe la stessa sessione/history. Il
 * server si limita a registrare (upsert idempotente) l'id ricevuto dal
 * client, associandolo al gameId.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export class SessionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionError';
    }
}

/**
 * Registra la sessione con l'id fornito dal client se non esiste ancora
 * (idempotente: chiamate successive con lo stesso sessionId, dallo stesso
 * turno di conversazione lato client, non creano righe duplicate né
 * sollevano errori).
 */
export async function getOrCreateSession(
    supabase: SupabaseClient,
    gameId: string,
    sessionId: string,
): Promise<string> {
    const { error } = await supabase
        .from('chat_sessions')
        .upsert({ id: sessionId, game_id: gameId }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
        throw new SessionError(`Errore registrando la sessione ${sessionId} per game_id=${gameId}: ${error.message}`);
    }

    return sessionId;
}
