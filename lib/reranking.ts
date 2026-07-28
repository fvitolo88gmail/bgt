// lib/reranking.ts
//
// Epica 0561 (R1) — reranking a valle del retrieve ampio già esistente in
// lib/retrieval.ts. Sostituisce la sola similarità coseno come criterio di
// selezione finale con un giudizio di pertinenza reale (una chiamata LLM
// dedicata sulla domanda originale, non arricchita).
//
// Motivazione (D52): un caso concreto ha mostrato il limite della sola
// similarità — "Come guadagna Legittimità la Classe Media?" aveva nel
// contesto sia le fonti corrette ("Lo Stato — ...") sia due chunk
// "Middle Class" topicamente irrilevanti alla domanda (stesso soggetto
// nominato, argomento diverso), inclusi solo perché la riserva
// MIN_MANUAL_CHUNKS prende "i migliori N per similarità grezza" senza
// verificare la pertinenza reale. Un reranking distingue esplicitamente
// "stesso soggetto, argomento diverso" da "risponde davvero alla domanda".
//
// Fail-soft per design, come il resto del retrieval (v. generateEnhancedQueries
// in lib/retrieval.ts): un errore qui non deve mai far fallire l'intera
// richiesta — il chiamante ricade sulla selezione per similarità.

import { geminiClient } from './gemini';

export interface RerankCandidate {
    id: string;
    label: string;
    content: string;
}

export interface RerankScore {
    id: string;
    score: number; // 0-10
}

// Contenuto troncato SOLO ai fini del giudizio di pertinenza (per contenere
// la dimensione del prompt di reranking) — non influisce sul contenuto
// pieno usato poi nel prompt di generazione, che resta quello originale.
const RERANK_CONTENT_PREVIEW_CHARS = 600;

const RERANK_PROMPT = (question: string, candidates: RerankCandidate[]) => `Sei un assistente che valuta la pertinenza di estratti (da un manuale di regole di un gioco da tavolo o da thread di forum) rispetto a una domanda specifica dell'utente.

Domanda dell'utente: "${question}"

Per ciascun estratto sotto, assegna un punteggio di pertinenza da 0 a 10:
- 8-10 = risponde direttamente e specificamente alla domanda.
- 4-7 = tratta lo stesso argomento generale ma non risponde in modo specifico, oppure è utile solo come contesto di sfondo.
- 0-3 = riguarda lo stesso soggetto/entità nominato nella domanda ma un argomento COMPLETAMENTE DIVERSO (es. la domanda riguarda un meccanismo specifico di un ruolo, l'estratto riguarda il setup iniziale o un'altra meccanica non correlata dello stesso ruolo). IMPORTANTE: non dare un punteggio alto solo perché l'estratto condivide un nome proprio (un ruolo, una carta) con la domanda — conta solo se l'estratto risponde davvero a COSA è stato chiesto.

Estratti da valutare:
${candidates.map((c) => `[id: ${c.id}] (${c.label})\n${c.content.slice(0, RERANK_CONTENT_PREVIEW_CHARS)}`).join('\n\n---\n\n')}

Rispondi SOLO con un array JSON di oggetti, uno per ciascun estratto sopra, in questo formato esatto, senza backtick, senza preamboli:
[{"id": "<id esatto tra quelli forniti>", "score": <numero 0-10>}, ...]`;

/**
 * Restituisce un punteggio di pertinenza 0-10 per ciascun candidato,
 * relativo alla domanda ORIGINALE dell'utente (non arricchita/HyDE — qui
 * serve il giudizio più fedele possibile a cosa l'utente ha davvero
 * chiesto, non una riformulazione). Ritorna null in caso di qualunque
 * errore (fail-soft): il chiamante deve ricadere sulla selezione per
 * similarità invece di far fallire l'intera richiesta.
 */
export async function rerankByRelevance(
    question: string,
    candidates: RerankCandidate[],
): Promise<RerankScore[] | null> {
    if (candidates.length === 0) return [];

    try {
        const raw = await geminiClient.generate(RERANK_PROMPT(question, candidates));
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed: unknown = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) {
            throw new Error('risposta non è un array');
        }

        const scores: RerankScore[] = parsed.map((item, i) => {
            if (typeof item !== 'object' || item === null) {
                throw new Error(`elemento ${i} non è un oggetto`);
            }
            const { id, score } = item as { id?: unknown; score?: unknown };
            if (typeof id !== 'string' || typeof score !== 'number' || Number.isNaN(score)) {
                throw new Error(`elemento ${i} ha campi mancanti o malformati`);
            }
            return { id, score };
        });

        return scores;
    } catch (err) {
        console.error('[reranking] fallito, procedo senza reranking (fallback a selezione per similarità):', err);
        return null;
    }
}
