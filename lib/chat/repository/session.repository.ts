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
 * sollevano errori). userId valorizzato solo alla creazione (ignoreDuplicates
 * salta l'upsert se la riga esiste già) — colma il gap segnalato in
 * BILLING-00001: senza user_id la sidebar (CHAT-LISTING-00002) non ha modo
 * di scopare l'elenco per utente via RLS.
 */
export async function getOrCreateSession(
    supabase: SupabaseClient,
    gameId: string,
    sessionId: string,
    userId: string | null = null,
): Promise<string> {
    const { error } = await supabase
        .from('chat_sessions')
        .upsert({ id: sessionId, game_id: gameId, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
        throw new SessionError(`Errore registrando la sessione ${sessionId} per game_id=${gameId}: ${error.message}`);
    }

    return sessionId;
}

export interface SessionSummary {
    id: string;
    title: string | null;
    lastMessageAt: string | null;
    createdAt: string;
}

interface SessionSummaryRow {
    id: string;
    title: string | null;
    last_message_at: string | null;
    created_at: string;
}

/**
 * Elenco delle conversazioni di un utente per un gioco, ordinate per ultimo
 * messaggio (fallback a created_at per sessioni senza ancora un turno
 * salvato). Filtro user_id esplicito, non lasciato alla sola RLS: la policy
 * di chat_sessions ammette anche user_id null ("sessione anonima", legacy
 * pre-CHAT-LISTING) per compatibilità con lo storico — senza questo filtro
 * ogni utente vedrebbe anche le vecchie sessioni anonime dello stesso gioco.
 */
export async function listSessionsForGame(
    supabase: SupabaseClient,
    gameId: string,
    userId: string,
): Promise<SessionSummary[]> {
    const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, last_message_at, created_at')
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) {
        throw new SessionError(`Errore elencando le conversazioni per game_id=${gameId}: ${error.message}`);
    }

    const rows = (data as SessionSummaryRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
    }));

    // Riordino difensivo lato applicazione: più recente prima, usando
    // last_message_at con fallback a created_at per le sessioni senza ancora
    // un turno salvato — non fidarsi del solo ORDER BY lato DB per l'ordine
    // finale mostrato in UI (nullsFirst/nullslast su colonne diverse è
    // facile da rompere in un refactor futuro della query senza che un
    // errore lato DB lo segnali).
    return rows.sort((a, b) => {
        const aTime = new Date(a.lastMessageAt ?? a.createdAt).getTime();
        const bTime = new Date(b.lastMessageAt ?? b.createdAt).getTime();
        return bTime - aTime;
    });
}

export interface RecentSessionSummary extends SessionSummary {
    gameId: string;
    gameName: string;
}

interface RecentSessionRow extends SessionSummaryRow {
    game_id: string;
    games: { name: string } | { name: string }[] | null;
}

/**
 * Conversazioni recenti di un utente su tutti i giochi (per la sezione
 * "Riprendi" in home) — a differenza di `listSessionsForGame` non filtra per
 * gameId. Solo sessioni con almeno un turno salvato (`last_message_at` non
 * null): una sessione creata ma mai usata non è una conversazione da
 * riprendere.
 */
export async function listRecentSessionsForUser(
    supabase: SupabaseClient,
    userId: string,
    limit: number,
): Promise<RecentSessionSummary[]> {
    const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, last_message_at, created_at, game_id, games(name)')
        .eq('user_id', userId)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(limit);

    if (error) {
        throw new SessionError(`Errore elencando le conversazioni recenti per user_id=${userId}: ${error.message}`);
    }

    return (data as unknown as RecentSessionRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
        gameId: row.game_id,
        gameName: (Array.isArray(row.games) ? row.games[0]?.name : row.games?.name) ?? 'Gioco',
    }));
}

/**
 * Imposta il titolo di una conversazione (generato altrove, es. da un
 * riassunto del primo turno) e aggiorna last_message_at per l'ordinamento
 * nella sidebar (CHAT-LISTING-00002).
 */
export async function setSessionTitle(
    supabase: SupabaseClient,
    sessionId: string,
    title: string,
): Promise<void> {
    const { error } = await supabase
        .from('chat_sessions')
        .update({ title, last_message_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) {
        throw new SessionError(`Errore impostando il titolo della sessione ${sessionId}: ${error.message}`);
    }
}

/**
 * Elimina una conversazione (e a cascata i suoi chat_messages, v. FK
 * `on delete cascade`) — user_id esplicito nella query stessa, non lasciato
 * al solo client passato dal chiamante: anche se il chiamante usa il
 * service client (che bypassa la RLS, D77), questo filtro impedisce di
 * cancellare la sessione di un altro utente. `user_requests.session_id` è
 * `on delete set null`: lo storico dei costi non viene perso, solo il
 * collegamento a questa conversazione specifica.
 */
export async function deleteSession(
    supabase: SupabaseClient,
    sessionId: string,
    userId: string,
): Promise<void> {
    // .select().single() dopo il delete: senza, un delete bloccato da RLS o
    // dal filtro user_id (id esistente ma di un altro utente) non genera un
    // errore, restituisce semplicemente zero righe — stesso problema già
    // incontrato con l'update del feedback (v. chat-history.repository.ts).
    const { data, error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select('id')
        .single();

    if (error || !data) {
        throw new SessionError(
            `Errore eliminando la sessione ${sessionId}: ${error?.message ?? 'nessuna riga eliminata (non trovata o non di proprietà dell\'utente)'}`
        );
    }
}

/**
 * Aggiorna last_message_at al turno più recente, senza toccare il titolo —
 * usata ad ogni turno successivo al primo per tenere l'ordinamento corretto.
 */
export async function touchSessionLastMessage(
    supabase: SupabaseClient,
    sessionId: string,
): Promise<void> {
    const { error } = await supabase
        .from('chat_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) {
        throw new SessionError(`Errore aggiornando last_message_at della sessione ${sessionId}: ${error.message}`);
    }
}
