/**
 * Lettura/scrittura dei turni in `chat_messages`, usata solo in modalità
 * "conversation" (v. app/api/chat/route.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationTurn } from './prompt';

export class ChatHistoryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatHistoryError';
    }
}

// Limite provvisorio sul numero di messaggi riletti per turno, come rete di
// sicurezza minima contro uno storico illimitato.
const HISTORY_MESSAGE_LIMIT = 20;

interface ChatMessageRow {
    role: string;
    content: string;
}

/**
 * Legge gli ultimi turni della sessione, in ordine cronologico (più vecchio
 * prima), pronti per essere iniettati nel prompt.
 */
export async function fetchRecentHistory(
    supabase: SupabaseClient,
    sessionId: string,
): Promise<ConversationTurn[]> {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_MESSAGE_LIMIT);

    if (error) {
        throw new ChatHistoryError(`Errore leggendo la history della sessione ${sessionId}: ${error.message}`);
    }

    const rows = (data ?? []) as ChatMessageRow[];
    return rows.reverse().map((row) => ({
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.content,
    }));
}

/**
 * Salva un turno (domanda utente o risposta assistente) nella sessione.
 */
export async function appendMessage(
    supabase: SupabaseClient,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
): Promise<void> {
    const { error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, role, content });

    if (error) {
        throw new ChatHistoryError(`Errore salvando il turno (${role}) per la sessione ${sessionId}: ${error.message}`);
    }
}
