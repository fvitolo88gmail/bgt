import { NextRequest, NextResponse } from 'next/server';
import { createInviteRequest } from '@/lib/repositories/invite-requests.repository';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as { email?: unknown; message?: unknown };
        const { email, message } = body;

        if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
            return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
        }
        if (message !== undefined && message !== null && typeof message !== 'string') {
            return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 });
        }

        await createInviteRequest(email, typeof message === 'string' ? message : null);

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        console.error('Invite request API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
