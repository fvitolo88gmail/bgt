// lib/gemini.ts

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

const ai = new GoogleGenAI({ apiKey });

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

async function withGeminiRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            if (!isTransientGeminiError(error) || attempt >= MAX_RETRIES) throw error;

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
    embed(text: string): Promise<number[]>;
    generate(prompt: string): Promise<string>;
}

export const geminiClient: LLMClient = {
    async embed(text: string): Promise<number[]> {
        return withGeminiRetry('embed', async () => {
            const result = await ai.models.embedContent({
                model: process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001',
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
    },

    async generate(prompt: string): Promise<string> {
        return withGeminiRetry('generate', async () => {
            const result = await ai.models.generateContent({
                model: process.env.CHAT_MODEL ?? 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                    temperature: 0.2, // basso deliberatamente: lookup fattuale su regole, non generazione creativa
                },
            });
            const text = result.text;
            if (!text) throw new Error('No text returned from Gemini');
            return text;
        });
    },
};

export async function generateFromPdfBase64(prompt: string, pdfBase64: string): Promise<string> {
    return withGeminiRetry('generateFromPdfBase64', async () => {
        const result = await ai.models.generateContent({
            model: process.env.CHAT_MODEL ?? 'gemini-3.1-flash-lite',
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
}