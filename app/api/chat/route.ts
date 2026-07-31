import { NextRequest, NextResponse } from 'next/server';
import { matchChunksForPrompt } from '@/lib/retrieval';
import { buildPrompt, buildConversationPrompt, buildContext, buildHistorySection } from '@/lib/prompt';
import { geminiClient } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getOrCreateSession } from '@/lib/session';
import { fetchRecentHistory, appendMessage } from '@/lib/chat-history';
import { contextualizeQueryForRetrieval } from '@/lib/query-contextualization';
import { createUserRequest, updateUserRequestOutcome } from '@/lib/repositories/usage-tracking.repository';

type ChatMode = 'qa' | 'conversation';

// Un problema nel tracking non deve mai bloccare la risposta all'utente —
// createUserRequest/updateUserRequestOutcome sono sempre avvolte in un catch
// che si limita a loggare e restituire null.
async function createUserRequestSafely(
    params: Parameters<typeof createUserRequest>[0],
): Promise<string | null> {
    try {
        return await createUserRequest(params);
    } catch (err) {
        console.error('[usage-tracking] impossibile creare user_request, si procede senza tracking:', err);
        return null;
    }
}

async function updateUserRequestOutcomeSafely(
    userRequestId: string | null,
    params: Parameters<typeof updateUserRequestOutcome>[1],
): Promise<void> {
    if (!userRequestId) return;
    try {
        await updateUserRequestOutcome(userRequestId, params);
    } catch (err) {
        console.error('[usage-tracking] impossibile aggiornare l\'esito di user_request:', err);
    }
}

export async function POST(req: NextRequest) {
    let userRequestId: string | null = null;

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

        // proxy.ts garantisce già che la richiesta arrivi con una sessione
        // valida — getUser() qui serve solo a risolvere l'id per il
        // tracking, fail-soft: un errore non deve bloccare la chat, user_id
        // resta nullable in user_requests proprio per questo.
        const userId = await createServerSupabaseClient()
            .then((client) => client.auth.getUser())
            .then(({ data }) => data.user?.id ?? null)
            .catch((err) => {
                console.error('[usage-tracking] impossibile risolvere l\'utente autenticato:', err);
                return null;
            });

        userRequestId = await createUserRequestSafely({ gameId, sessionId, userId, mode });

        const history = sessionId
            ? await fetchRecentHistory(supabase, sessionId)
            : [];

        // Solo in conversazione: un follow-up ("dimmi di più su questo")
        // spesso non ha contenuto semantico proprio — il retrieval usa una
        // riscrittura standalone, la domanda originale resta invariata.
        const retrievalQuery = history.length > 0
            ? await contextualizeQueryForRetrieval(question, history, userRequestId)
            : question;

        // gameId (base) sempre incluso; le espansioni sono opt-in esplicito dal client,
        // così di default il retrieval resta scoped al solo gioco base.
        const retrievalGameIds = [gameId, ...(expansionGameIds ?? [])];
        const { context: promptChunks, sources: matches } = await matchChunksForPrompt(retrievalQuery, retrievalGameIds, 10, userRequestId);

        if (promptChunks.length === 0) {
            const answer = 'Non ho trovato questa informazione nel manuale.';
            let assistantMessageId: string | null = null;
            if (sessionId) {
                await appendMessage(supabase, sessionId, 'user', question);
                assistantMessageId = await appendMessage(supabase, sessionId, 'assistant', answer);
            }
            await updateUserRequestOutcomeSafely(userRequestId, { chunksRetrievedCount: 0, status: 'success' });
            return NextResponse.json({ answer, sources: [], messageId: assistantMessageId });
        }

        const context = buildContext(promptChunks);
        const prompt = mode === 'conversation'
            ? buildConversationPrompt(question, context, buildHistorySection(history))
            : buildPrompt(question, context);
        const answer = await geminiClient.generate(
            prompt,
            userRequestId ? { userRequestId, callType: 'generation' } : undefined,
        );

        let assistantMessageId: string | null = null;
        if (sessionId) {
            await appendMessage(supabase, sessionId, 'user', question);
            assistantMessageId = await appendMessage(supabase, sessionId, 'assistant', answer);
        }

        await updateUserRequestOutcomeSafely(userRequestId, { chunksRetrievedCount: matches.length, status: 'success' });

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
        await updateUserRequestOutcomeSafely(userRequestId, { chunksRetrievedCount: null, status: 'error' });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
