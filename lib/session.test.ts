import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateSession, SessionError } from './session';

function mockSupabase(upsertResult: { error: { message: string } | null }): {
    client: SupabaseClient;
    upsertSpy: ReturnType<typeof vi.fn>;
} {
    const upsertSpy = vi.fn(async () => upsertResult);
    const client = {
        from: () => ({ upsert: upsertSpy }),
    } as unknown as SupabaseClient;

    return { client, upsertSpy };
}

describe('getOrCreateSession', () => {
    it('registra la sessione con l\'id fornito dal client e lo restituisce invariato', async () => {
        const { client, upsertSpy } = mockSupabase({ error: null });

        await expect(getOrCreateSession(client, 'game-1', 'session-abc')).resolves.toBe('session-abc');
        expect(upsertSpy).toHaveBeenCalledWith(
            { id: 'session-abc', game_id: 'game-1' },
            { onConflict: 'id', ignoreDuplicates: true },
        );
    });

    it('è idempotente: una seconda chiamata con lo stesso sessionId non fallisce', async () => {
        const { client, upsertSpy } = mockSupabase({ error: null });

        await getOrCreateSession(client, 'game-1', 'session-abc');
        await expect(getOrCreateSession(client, 'game-1', 'session-abc')).resolves.toBe('session-abc');
        expect(upsertSpy).toHaveBeenCalledTimes(2);
    });

    it('lancia SessionError se l\'upsert fallisce', async () => {
        const { client } = mockSupabase({ error: { message: 'connection refused' } });

        await expect(getOrCreateSession(client, 'game-1', 'session-abc')).rejects.toThrow(SessionError);
    });
});
