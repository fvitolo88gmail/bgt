/**
 * Scrittura di user_requests/gemini_calls (BILLING-00001). Sempre via service
 * client: sono log interni (RLS admin-only in lettura, v. migration
 * 20260731000000_usage_tracking.sql), nessun ruolo applicativo deve scriverci
 * direttamente. Fail-soft per design nei chiamanti (lib/gemini.ts, route.ts):
 * un errore qui non deve mai interrompere la risposta all'utente.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../supabase';

export type GeminiCallType =
    | 'embedding'
    | 'generation'
    | 'query_contextualization'
    | 'query_enhancement'
    | 'reranking';

export interface GeminiCallContext {
    userRequestId: string;
    callType: GeminiCallType;
}

export type ChatMode = 'qa' | 'conversation';

/**
 * Crea la riga che raggruppa tutte le chiamate Gemini di una domanda utente.
 */
export async function createUserRequest(params: {
    gameId: string;
    sessionId: string | null;
    userId: string | null;
    mode: ChatMode;
}): Promise<string> {
    const client = createServiceClient();
    const { data, error } = await client
        .from('user_requests')
        .insert({
            game_id: params.gameId,
            session_id: params.sessionId,
            user_id: params.userId,
            mode: params.mode,
        })
        .select('id')
        .single();

    if (error || !data) {
        throw new Error(`Errore creando user_request: ${error?.message ?? 'nessuna riga restituita'}`);
    }

    return (data as { id: string }).id;
}

/**
 * Aggiorna l'esito complessivo dell'interazione, chiamata una volta a fine
 * richiesta (chunks recuperati + stato finale).
 */
export async function updateUserRequestOutcome(
    userRequestId: string,
    params: { chunksRetrievedCount: number | null; status: 'success' | 'error' },
): Promise<void> {
    const client = createServiceClient();
    const { error } = await client
        .from('user_requests')
        .update({ chunks_retrieved_count: params.chunksRetrievedCount, status: params.status })
        .eq('id', userRequestId);

    if (error) {
        throw new Error(`Errore aggiornando l'esito di user_request ${userRequestId}: ${error.message}`);
    }
}

/**
 * Registra una singola chiamata Gemini. token count assenti (es. embed
 * fallito prima di ricevere risposta) restano null, non azzerati — un costo
 * di 0 esplicito sarebbe indistinguibile da "nessun token consumato". Niente
 * prezzo/costo qui: calcolati a lettura via la vista `gemini_calls_costed`,
 * che fa il join con `model_pricing` sul periodo di validità in vigore al
 * momento della chiamata (`created_at`) — permette di correggere il costo
 * storico se un aggiornamento prezzo viene registrato in ritardo, invece di
 * congelarlo (sbagliato) per sempre in questa riga.
 */
export async function logGeminiCall(params: {
    userRequestId: string;
    callType: GeminiCallType;
    modelName: string;
    promptTokenCount: number | null;
    candidatesTokenCount: number | null;
    cachedTokenCount: number | null;
    status: 'success' | 'error' | 'timeout';
    retryCount: number;
}): Promise<void> {
    const client = createServiceClient();
    const { error } = await client.from('gemini_calls').insert({
        user_request_id: params.userRequestId,
        call_type: params.callType,
        model_name: params.modelName,
        prompt_token_count: params.promptTokenCount,
        candidates_token_count: params.candidatesTokenCount,
        cached_token_count: params.cachedTokenCount,
        status: params.status,
        retry_count: params.retryCount,
    });

    if (error) {
        throw new Error(`Errore loggando la chiamata Gemini (${params.callType}) per user_request ${params.userRequestId}: ${error.message}`);
    }
}

// --- BILLING-00002: lettura per il pannello admin costi ---
// A differenza delle scritture sopra (sempre service client, log interni),
// le letture qui prendono il client del chiamante: la RLS admin-only su
// user_requests/gemini_calls/model_pricing resta l'enforcement reale, il
// controllo ruolo nella pagina (app/admin/costs/page.tsx) è solo UX
// (redirect prima ancora di interrogare il DB), non l'unica difesa.

export interface UserRequestCostRow {
    userRequestId: string;
    gameId: string;
    mode: ChatMode;
    status: 'success' | 'error';
    createdAt: string;
    totalCostUsd: number;
}

interface UserRequestCostQueryRow {
    user_request_id: string;
    game_id: string;
    mode: string;
    status: string;
    created_at: string;
    total_cost_usd: number | string; // numeric torna come stringa dal client Supabase
}

/**
 * Una riga per interazione con il costo totale già sommato (vista
 * `user_request_costs`) — base per costo medio/query, distribuzione per
 * gioco e andamento nel tempo, aggregati poi in JS: volume ancora troppo
 * piccolo per giustificare RPC dedicate per ogni aggregazione.
 */
export async function getUserRequestCosts(supabase: SupabaseClient): Promise<UserRequestCostRow[]> {
    const { data, error } = await supabase
        .from('user_request_costs')
        .select('user_request_id, game_id, mode, status, created_at, total_cost_usd')
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(`Errore leggendo user_request_costs: ${error.message}`);
    }

    return (data as UserRequestCostQueryRow[]).map((row) => ({
        userRequestId: row.user_request_id,
        gameId: row.game_id,
        mode: row.mode === 'conversation' ? 'conversation' : 'qa',
        status: row.status === 'error' ? 'error' : 'success',
        createdAt: row.created_at,
        totalCostUsd: Number(row.total_cost_usd),
    }));
}
