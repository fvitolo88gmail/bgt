import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/shared/supabase';
import { setMessageFeedback } from '@/lib/chat/repository/chat-history.repository';

// Endpoint dedicato al pollice su/giù sulle risposte assistant (solo
// modalità "conversation", unica modalità che salva chat_messages oggi).
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json() as { messageId?: string; feedback?: string | null };
        const { messageId, feedback } = body;

        // null è un valore valido: click sul voto già selezionato → deselezione.
        if (!messageId || (feedback !== 'good' && feedback !== 'bad' && feedback !== null)) {
            return NextResponse.json(
                { error: 'Missing messageId or invalid feedback (atteso "good", "bad" o null)' },
                { status: 400 },
            );
        }

        // chat_messages può appartenere a una sessione con user_id valorizzato (D77): il client
        // anonimo non soddisfa mai la policy RLS di update in quel caso — service client, stesso
        // principio già seguito per le altre scritture chat_sessions/chat_messages in route.ts.
        await setMessageFeedback(createServiceClient(), messageId, feedback);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('Chat feedback API error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
