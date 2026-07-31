// lib/gemini.ts

import { GoogleGenAI } from '@google/genai';
import { logGeminiCall, type GeminiCallContext } from '../billing/repository/usage-tracking.repository';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

const ai = new GoogleGenAI({ apiKey });

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001';
const CHAT_MODEL = process.env.CHAT_MODEL ?? 'gemini-3.1-flash-lite';

// L'API embedContent (chiave AI Studio) non restituisce un conteggio token
// reale in risposta (solo billableCharacterCount, riservato a Enterprise) —
// approssimazione standard caratteri/4, sufficiente per una proiezione di
// costo, non un valore fatturato esatto.
function estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
}

// Un log fallito non deve mai far fallire la chiamata Gemini che lo ha
// generato.
async function logGeminiCallSafely(params: Parameters<typeof logGeminiCall>[0]): Promise<void> {
    try {
        await logGeminiCall(params);
    } catch (err) {
        console.error('[usage-tracking] logging chiamata Gemini fallito:', err);
    }
}

// Il chiamante (embed/generate) riceve l'errore originale (cause), non
// GeminiRetryError — qui si estrae solo il retryCount per il logging prima
// di rilanciare quello originale.
function unwrapRetryError(error: unknown): { cause: unknown; retryCount: number } {
    if (error instanceof GeminiRetryError) {
        return { cause: error.cause, retryCount: error.retryCount };
    }
    return { cause: error, retryCount: 0 };
}

/**
 * Retry con backoff per errori TRANSITORI di Gemini: 503 (UNAVAILABLE,
 * sovraccarico temporaneo lato Google — "high demand", osservato in
 * sessione su generate() sia in produzione /api/chat sia nell'eval judge)
 * e 429 (RESOURCE_EXHAUSTED, quota — già gestito ad-hoc solo dentro
 * forum-ingest.ts come embedWithRetry, ora centralizzato qui per TUTTI i
 * chiamanti, embed e generate).
 *
 * Se l'errore Gemini include un retryDelay esplicito (tipico del 429), lo
 * rispetta; altrimenti usa backoff esponenziale con jitter, a partire da
 * INITIAL_BACKOFF_MS.
 */
const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 2000;

function isTransientGeminiError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
        message.includes('UNAVAILABLE') ||
        message.includes('"code":503') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('"code":429')
    );
}

function extractRetryDelaySeconds(error: unknown): number | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/retryDelay":"(\d+)s/);
    return match?.[1] ? Number(match[1]) : null;
}

interface RetryResult<T> {
    value: T;
    retryCount: number;
}

// Errore arricchito col numero di tentativi già assorbiti: serve al
// chiamante per loggare retry_count anche su un esito finale di errore,
// non solo su successo.
class GeminiRetryError extends Error {
    constructor(public readonly cause: unknown, public readonly retryCount: number) {
        super(cause instanceof Error ? cause.message : String(cause));
    }
}

// Espone il numero di tentativi assorbiti (colonna gemini_calls.retry_count)
// invece del solo valore finale.
async function withGeminiRetry<T>(label: string, fn: () => Promise<T>): Promise<RetryResult<T>> {
    let attempt = 0;
    while (true) {
        try {
            const value = await fn();
            return { value, retryCount: attempt };
        } catch (error) {
            if (!isTransientGeminiError(error) || attempt >= MAX_RETRIES) throw new GeminiRetryError(error, attempt);

            attempt += 1;
            const explicitDelay = extractRetryDelaySeconds(error);
            const backoffMs = explicitDelay
                ? (explicitDelay + 2) * 1000
                : INITIAL_BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * 500;

            console.warn(
                `[gemini] ${label}: errore transitorio (tentativo ${attempt}/${MAX_RETRIES}), attesa ${Math.round(backoffMs / 1000)}s...`,
            );
            await new Promise((res) => setTimeout(res, backoffMs));
        }
    }
}

export interface LLMClient {
    embed(text: string, context?: GeminiCallContext): Promise<number[]>;
    generate(prompt: string, context?: GeminiCallContext): Promise<string>;
}

export const geminiClient: LLMClient = {
    async embed(text: string, context?: GeminiCallContext): Promise<number[]> {
        try {
            const { value, retryCount } = await withGeminiRetry('embed', async () => {
                const result = await ai.models.embedContent({
                    model: EMBEDDING_MODEL,
                    contents: text,
                    config: {
                        outputDimensionality: parseInt(
                            process.env.EMBEDDING_DIMENSIONS ?? '768'
                        ),
                    },
                });
                const values = result.embeddings?.[0]?.values;
                if (!values) throw new Error('No embedding values returned');
                return values;
            });

            if (context) {
                await logGeminiCallSafely({
                    userRequestId: context.userRequestId,
                    callType: context.callType,
                    modelName: EMBEDDING_MODEL,
                    promptTokenCount: estimateTokenCount(text),
                    candidatesTokenCount: null,
                    cachedTokenCount: null,
                    status: 'success',
                    retryCount,
                });
            }

            return value;
        } catch (error) {
            const { cause, retryCount } = unwrapRetryError(error);
            if (context) {
                await logGeminiCallSafely({
                    userRequestId: context.userRequestId,
                    callType: context.callType,
                    modelName: EMBEDDING_MODEL,
                    promptTokenCount: null,
                    candidatesTokenCount: null,
                    cachedTokenCount: null,
                    status: 'error',
                    retryCount,
                });
            }
            throw cause;
        }
    },

    async generate(prompt: string, context?: GeminiCallContext): Promise<string> {
        try {
            const { value, retryCount } = await withGeminiRetry('generate', async () => {
                const result = await ai.models.generateContent({
                    model: CHAT_MODEL,
                    contents: prompt,
                    config: {
                        temperature: 0.2, // basso deliberatamente: lookup fattuale su regole, non generazione creativa
                    },
                });
                const text = result.text;
                if (!text) throw new Error('No text returned from Gemini');
                return { text, usage: result.usageMetadata };
            });

            if (context) {
                await logGeminiCallSafely({
                    userRequestId: context.userRequestId,
                    callType: context.callType,
                    modelName: CHAT_MODEL,
                    promptTokenCount: value.usage?.promptTokenCount ?? null,
                    candidatesTokenCount: value.usage?.candidatesTokenCount ?? null,
                    cachedTokenCount: value.usage?.cachedContentTokenCount ?? null,
                    status: 'success',
                    retryCount,
                });
            }

            return value.text;
        } catch (error) {
            const { cause, retryCount } = unwrapRetryError(error);
            if (context) {
                await logGeminiCallSafely({
                    userRequestId: context.userRequestId,
                    callType: context.callType,
                    modelName: CHAT_MODEL,
                    promptTokenCount: null,
                    candidatesTokenCount: null,
                    cachedTokenCount: null,
                    status: 'error',
                    retryCount,
                });
            }
            throw cause;
        }
    },
};

// Fuori da LLMClient di proposito: percorso di ingest PDF (script locale,
// mai in una richiesta utente), nessuna interazione da tracciare.
export async function generateFromPdfBase64(prompt: string, pdfBase64: string): Promise<string> {
    try {
        const { value } = await withGeminiRetry('generateFromPdfBase64', async () => {
            const result = await ai.models.generateContent({
                model: CHAT_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                        ],
                    },
                ],
            });
            const text = result.text;
            if (!text) throw new Error('No text returned from Gemini (PDF input)');
            return text;
        });
        return value;
    } catch (error) {
        throw unwrapRetryError(error).cause;
    }
}