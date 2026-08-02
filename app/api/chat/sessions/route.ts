import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { listSessionsForGame } from '@/lib/chat/repository/session.repository';

// Elenco conversazioni per la sidebar (CHAT-LISTING-00002) — client con
// sessione via cookie (non service client come route.ts): qui l'endpoint
// espone direttamente al browser l'elenco delle conversazioni dell'utente,
// quindi la RLS di chat_sessions (scoped su auth.uid()) è l'enforcement
// reale, non solo una comodità. Utente non autenticato → nessuna riga
// (auth.uid() null non soddisfa "user_id = auth.uid()").
export async function GET(req: NextRequest) {
    try {
        const gameId = req.nextUrl.searchParams.get('gameId');
        if (!gameId) {
            return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ sessions: [] });
        }

        const sessions = await listSessionsForGame(supabase, gameId, user.id);

        return NextResponse.json({ sessions });
    } catch (err) {
        console.error('Chat sessions API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
