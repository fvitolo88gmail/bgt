import { NextRequest, NextResponse } from 'next/server';
import { matchChunks } from '@/lib/retrieval';
import { buildPrompt, buildContext } from '@/lib/prompt';
import { geminiClient } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { question?: string; gameId?: string };
        const { question, gameId } = body;

        if (!question || !gameId) {
            return NextResponse.json(
                { error: 'Missing question or gameId' },
                { status: 400 },
            );
        }

        const chunks = await matchChunks(question, gameId, 5, 'manual');

        if (chunks.length === 0) {
            return NextResponse.json({
                answer: 'Non ho trovato questa informazione nel manuale.',
                sources: [],
            });
        }

        const context = buildContext(chunks);
        const prompt = buildPrompt(question, context);
        const answer = await geminiClient.generate(prompt);

        const sources = chunks.map((chunk) => ({
            page: chunk.page,
            section: chunk.section,
            similarity: chunk.similarity,
        }));

        return NextResponse.json({ answer, sources });
    } catch (err) {
        console.error('Chat API error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}