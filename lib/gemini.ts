import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

const ai = new GoogleGenAI({ apiKey });

export interface LLMClient {
    embed(text: string): Promise<number[]>;
    generate(prompt: string): Promise<string>;
}

export const geminiClient: LLMClient = {
    async embed(text: string): Promise<number[]> {
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
    },

    async generate(prompt: string): Promise<string> {
        const result = await ai.models.generateContent({
            model: process.env.CHAT_MODEL ?? 'gemini-3.1-flash-lite',
            contents: prompt,
        });
        const text = result.text;
        if (!text) throw new Error('No text returned from Gemini');
        return text;
    },
};