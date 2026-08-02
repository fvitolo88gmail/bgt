import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { createServiceClient } from '@/lib/shared/supabase';
import { deleteSession, SessionError } from '@/lib/chat/repository/session.repository';

// Eliminazione di una conversazione dalla sidebar. Risolve l'utente dal
// client con sessione via cookie (come le altre route sotto /api/chat/sessions),
// poi elimina via service client — stesso motivo di D77: chat_sessions ora
// può avere user_id valorizzato, il client anonimo non soddisfa la RLS.
// L'ownership resta comunque garantita dal filtro user_id esplicito dentro
// deleteSession, non dal solo bypass del service client.
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    try {
        const { sessionId } = await params;

        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await deleteSession(createServiceClient(), sessionId, user.id);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('Chat session delete API error:', err);
        const status = err instanceof SessionError ? 404 : 500;
        return NextResponse.json({ error: 'Internal server error' }, { status });
    }
}
