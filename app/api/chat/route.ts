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
        const body = await req.json() as {
            question?: string;
            gameId?: string;
            mode?: string;
            sessionId?: string;
            expansionGameIds?: string[];
        };
        const { question, gameId, expansionGameIds } = body;
        // "conversation" inietta la history e salva il turno, "qa" (default) resta invariato.
        const mode: ChatMode = body.mode === 'conversation' ? 'conversation' : 'qa';

        if (!question || !gameId) {
            return NextResponse.json(
                { error: 'Missing question or gameId' },
                { status: 400 },
            );
        }

        // Il sessionId è generato dal client (una sessione nuova a ogni
        // apertura della chat) — obbligatorio in modalità conversazione.
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

        // Solo in conversazione: un follow-up ("dimmi di più su questo")
        // spesso non ha contenuto semantico proprio — il retrieval usa una
        // riscrittura standalone, la domanda originale resta invariata.
        const retrievalQuery = history.length > 0
            ? await contextualizeQueryForRetrieval(question, history)
            : question;

        // gameId (base) sempre incluso; le espansioni sono opt-in esplicito dal client,
        // così di default il retrieval resta scoped al solo gioco base.
        const retrievalGameIds = [gameId, ...(expansionGameIds ?? [])];
        const { context: promptChunks, sources: matches } = await matchChunksForPrompt(retrievalQuery, retrievalGameIds, 10);

        if (promptChunks.length === 0) {
            const answer = 'Non ho trovato questa informazione nel manuale.';
            let assistantMessageId: string | null = null;
            if (sessionId) {
                await appendMessage(supabase, sessionId, 'user', question);
                assistantMessageId = await appendMessage(supabase, sessionId, 'assistant', answer);
            }
            return NextResponse.json({ answer, sources: [], messageId: assistantMessageId });
        }

        const context = buildContext(promptChunks);
        const prompt = mode === 'conversation'
            ? buildConversationPrompt(question, context, buildHistorySection(history))
            : buildPrompt(question, context);
        const answer = await geminiClient.generate(prompt);

        let assistantMessageId: string | null = null;
        if (sessionId) {
            await appendMessage(supabase, sessionId, 'user', question);
            assistantMessageId = await appendMessage(supabase, sessionId, 'assistant', answer);
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

        return NextResponse.json({ answer, sources, messageId: assistantMessageId });
    } catch (err) {
        console.error('Chat API error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
