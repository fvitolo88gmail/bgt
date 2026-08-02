/**
 * Lettura/scrittura dei turni in `chat_messages`, usata solo in modalità
 * "conversation" (v. app/api/chat/route.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationTurn } from '../prompt';

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

export interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    feedback: 'good' | 'bad' | null;
}

interface DisplayMessageRow {
    id: string;
    role: string;
    content: string;
    feedback: string | null;
}

/**
 * Legge TUTTI i turni di una sessione, in ordine cronologico, con id e
 * feedback — a differenza di `fetchRecentHistory` (usata per iniettare
 * contesto nel prompt, limitata e senza id) questa è per la ripresa di una
 * conversazione dalla sidebar (CHAT-LISTING-00003): serve l'id per
 * riagganciare il pollice su/giù e nessun limite, l'utente deve rivedere
 * l'intera conversazione che ha selezionato.
 */
export async function fetchMessagesForDisplay(
    supabase: SupabaseClient,
    sessionId: string,
): Promise<DisplayMessage[]> {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, feedback')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new ChatHistoryError(`Errore leggendo i messaggi della sessione ${sessionId}: ${error.message}`);
    }

    return (data as DisplayMessageRow[]).map((row) => ({
        id: row.id,
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.content,
        feedback: row.feedback === 'good' || row.feedback === 'bad' ? row.feedback : null,
    }));
}

/**
 * Salva un turno (domanda utente o risposta assistente) nella sessione.
 * Ritorna l'id del messaggio inserito — serve al chiamante per agganciare
 * in seguito il feedback (pollice su/giù) alla risposta assistant.
 */
export async function appendMessage(
    supabase: SupabaseClient,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
): Promise<string> {
    const { data, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, role, content })
        .select('id')
        .single();

    if (error) {
        throw new ChatHistoryError(`Errore salvando il turno (${role}) per la sessione ${sessionId}: ${error.message}`);
    }

    return (data as { id: string }).id;
}

/**
 * Registra il feedback (good/bad/null) di un messaggio assistant già salvato.
 * null è un valore valido: click sul voto già selezionato → deselezione.
 * Non verifica il ruolo del messaggio: l'endpoint chiamante espone il
 * pollice solo sui messaggi assistant, quindi un id di un messaggio "user"
 * non dovrebbe mai arrivare qui, ma la colonna accetta comunque il valore.
 */
export async function setMessageFeedback(
    supabase: SupabaseClient,
    messageId: string,
    feedback: 'good' | 'bad' | null,
): Promise<void> {
    // .select().single() dopo l'update: un update bloccato da RLS non genera un errore,
    // restituisce semplicemente zero righe — senza questo controllo il fallimento passa
    // inosservato (già successo: mancava la policy di update su chat_messages).
    const { data, error } = await supabase
        .from('chat_messages')
        .update({ feedback })
        .eq('id', messageId)
        .select('id')
        .single();

    if (error || !data) {
        throw new ChatHistoryError(
            `Errore salvando il feedback per il messaggio ${messageId}: ${error?.message ?? 'nessuna riga aggiornata (RLS o id inesistente)'}`
        );
    }
}
