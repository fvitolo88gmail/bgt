import { NextRequest, NextResponse } from 'next/server';
import { matchChunksForPrompt } from '@/lib/retrieval';
import { buildPrompt, buildConversationPrompt, buildContext, buildHistorySection } from '@/lib/prompt';
import { geminiClient } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { getOrCreateSession } from '@/lib/session';
import { fetchRecentHistory, appendMessage } from '@/lib/chat-history';
import { contextualizeQueryForRetrieval } from '@/lib/query-contextualization';

type ChatMode = 'qa' | 'conversation';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { question?: string; gameId?: string; mode?: string; sessionId?: string };
        const { question, gameId } = body;
        // Epica 0900 (Chat con contesto) — C3: "conversation" inietta la
        // history e salva il turno, "qa" (default) resta invariato.
        const mode: ChatMode = body.mode === 'conversation' ? 'conversation' : 'qa';

        if (!question || !gameId) {
            return NextResponse.json(
                { error: 'Missing question or gameId' },
                { status: 400 },
            );
        }

        // D45: il sessionId è generato dal client (una sessione nuova a ogni
        // apertura della chat, non riusata tra aperture diverse dello stesso
        // gioco) — obbligatorio in modalità conversazione.
        if (mode === 'conversation' && !body.sessionId) {
            return NextResponse.json(
                { error: 'Missing sessionId for conversation mode' },
                { status: 400 },
            );
        }

        const sessionId = mode === 'conversation' && body.sessionId
            ? await getOrCreateSession(supabase, gameId, body.sessionId)
            : null;

        const history = sessionId
            ? await fetchRecentHistory(supabase, sessionId)
            : [];

        // Solo in conversazione: la domanda grezza di un follow-up ("dimmi
        // di più su questo thread") spesso non ha contenuto semantico
        // proprio — il retrieval usa una riscrittura standalone basata sulla
        // history, la domanda originale resta invariata per il resto (v.
        // lib/query-contextualization.ts).
        const retrievalQuery = history.length > 0
            ? await contextualizeQueryForRetrieval(question, history)
            : question;

        const { context: promptChunks, sources: matches } = await matchChunksForPrompt(retrievalQuery, gameId, 10);

        if (promptChunks.length === 0) {
            const answer = 'Non ho trovato questa informazione nel manuale.';
            if (sessionId) {
                await appendMessage(supabase, sessionId, 'user', question);
                await appendMessage(supabase, sessionId, 'assistant', answer);
            }
            return NextResponse.json({ answer, sources: [] });
        }

        const context = buildContext(promptChunks);
        const prompt = mode === 'conversation'
            ? buildConversationPrompt(question, context, buildHistorySection(history))
            : buildPrompt(question, context);
        const answer = await geminiClient.generate(prompt);

        if (sessionId) {
            await appendMessage(supabase, sessionId, 'user', question);
            await appendMessage(supabase, sessionId, 'assistant', answer);
        }

        const sources = matches.map((match) => ({
            source: match.source,
            page: match.page,
            section: match.section,
            threadSubject: match.threadSubject,
            isDesignerResponse: match.isDesignerResponse,
            similarity: match.similarity,
            bggUrl: match.bggUrl,
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
