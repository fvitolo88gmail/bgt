import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { fetchMessagesForDisplay } from '@/lib/chat/repository/chat-history.repository';

// Ripresa di una conversazione dalla sidebar (CHAT-LISTING-00003) — client
// con sessione via cookie, non service client: la RLS di chat_messages
// (ereditata da chat_sessions.user_id, v. 20260729020000_rls_policies.sql)
// è l'enforcement reale, questo endpoint è chiamato direttamente dal
// browser. Un utente non autenticato o non proprietario della sessione
// riceve semplicemente zero righe.
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    try {
        const { sessionId } = await params;
        const supabase = await createServerSupabaseClient();
        const messages = await fetchMessagesForDisplay(supabase, sessionId);

        return NextResponse.json({ messages });
    } catch (err) {
        console.error('Chat session messages API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
