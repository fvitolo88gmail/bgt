/**
 * Riscrittura della domanda per il retrieval in modalità "conversation".
 *
 * Un follow-up come "dimmi di più su questo thread" non porta contenuto
 * semantico proprio — il retrieval sulla sola domanda grezza recupera chunk
 * estranei, anche se la history viene comunque iniettata nel prompt di
 * generazione (che arriva "tardi", a scelta delle fonti già fatta).
 *
 * Soluzione: solo in modalità conversazione, prima del retrieval, un
 * passaggio isolato riscrive la domanda in forma autonoma, risolvendo
 * pronomi/riferimenti impliciti usando gli ultimi turni. La query riscritta
 * è usata solo per il retrieval — la domanda originale resta quella
 * mostrata al modello di generazione e quella salvata in chat_messages.
 *
 * Fail-soft: se la riscrittura fallisce, si procede con la domanda
 * originale invece di far fallire l'intera risposta.
 */

import { geminiClient } from './gemini';
import type { ConversationTurn } from './prompt';

const QUERY_CONTEXTUALIZATION_PROMPT = (question: string, history: ConversationTurn[]) => {
    const formattedHistory = history
        .map((turn) => `${turn.role === 'user' ? 'Utente' : 'Assistente'}: ${turn.content}`)
        .join('\n');

    return `Sei un assistente che riformula domande di follow-up in una conversazione su regole di un gioco da tavolo, per renderle utilizzabili da un sistema di ricerca semantica (RAG) che non vede lo storico.

STORICO CONVERSAZIONE:
${formattedHistory}

DOMANDA ATTUALE (può contenere pronomi o riferimenti impliciti allo storico, es. "questo", "quel thread", "e se invece..."):
"${question}"

Compito: riscrivi la domanda attuale come domanda autonoma (standalone), esplicitando a cosa si riferiscono eventuali pronomi/riferimenti impliciti usando lo storico sopra. Se la domanda è già autonoma e non contiene riferimenti impliciti, restituiscila invariata.

Rispondi SOLO con la domanda riscritta, una singola riga di testo, senza virgolette, senza preamboli, senza spiegazioni.`;
};

/**
 * Riscrive `question` in forma autonoma per il retrieval, usando gli ultimi
 * turni della conversazione. Fail-soft: in caso di history vuota o errore,
 * restituisce la domanda originale invariata.
 */
export async function contextualizeQueryForRetrieval(
    question: string,
    history: ConversationTurn[],
    userRequestId?: string | null,
): Promise<string> {
    if (history.length === 0) return question;

    try {
        const raw = await geminiClient.generate(
            QUERY_CONTEXTUALIZATION_PROMPT(question, history),
            userRequestId ? { userRequestId, callType: 'query_contextualization' } : undefined,
        );
        const rewritten = raw.trim().replace(/^["']|["']$/g, '');
        if (!rewritten) {
            throw new Error('riscrittura vuota');
        }
        return rewritten;
    } catch (err) {
        console.error('[query-contextualization] riscrittura fallita, procedo con la domanda originale:', err);
        return question;
    }
}
