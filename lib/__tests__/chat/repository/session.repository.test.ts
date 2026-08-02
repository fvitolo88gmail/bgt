import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateSession, setSessionTitle, touchSessionLastMessage, listSessionsForGame, deleteSession, SessionError } from '../../../chat/repository/session.repository';

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

function mockSupabaseUpdate(updateResult: { error: { message: string } | null }): {
    client: SupabaseClient;
    updateSpy: ReturnType<typeof vi.fn>;
    eqSpy: ReturnType<typeof vi.fn>;
} {
    const eqSpy = vi.fn(async () => updateResult);
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = {
        from: () => ({ update: updateSpy }),
    } as unknown as SupabaseClient;

    return { client, updateSpy, eqSpy };
}

describe('getOrCreateSession', () => {
    it('registra la sessione con l\'id fornito dal client e lo restituisce invariato', async () => {
        const { client, upsertSpy } = mockSupabase({ error: null });

        await expect(getOrCreateSession(client, 'game-1', 'session-abc')).resolves.toBe('session-abc');
        expect(upsertSpy).toHaveBeenCalledWith(
            { id: 'session-abc', game_id: 'game-1', user_id: null },
            { onConflict: 'id', ignoreDuplicates: true },
        );
    });

    it('passa user_id quando fornito, per popolare la proprietà alla creazione', async () => {
        const { client, upsertSpy } = mockSupabase({ error: null });

        await getOrCreateSession(client, 'game-1', 'session-abc', 'user-1');

        expect(upsertSpy).toHaveBeenCalledWith(
            { id: 'session-abc', game_id: 'game-1', user_id: 'user-1' },
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

describe('listSessionsForGame', () => {
    function mockSupabaseSelect(result: { data: unknown[] | null; error: { message: string } | null }): {
        client: SupabaseClient;
        eqGameIdSpy: ReturnType<typeof vi.fn>;
        eqUserIdSpy: ReturnType<typeof vi.fn>;
    } {
        const eqUserIdSpy = vi.fn(() => ({ order: () => ({ order: async () => result }) }));
        const eqGameIdSpy = vi.fn(() => ({ eq: eqUserIdSpy }));
        const selectSpy = vi.fn(() => ({ eq: eqGameIdSpy }));
        const client = {
            from: () => ({ select: selectSpy }),
        } as unknown as SupabaseClient;

        return { client, eqGameIdSpy, eqUserIdSpy };
    }

    it('filtra esplicitamente per game_id e user_id, non solo via RLS', async () => {
        const { client, eqGameIdSpy, eqUserIdSpy } = mockSupabaseSelect({
            data: [{ id: 's1', title: 'Apertura', last_message_at: '2026-08-02T10:00:00Z', created_at: '2026-08-02T09:00:00Z' }],
            error: null,
        });

        const result = await listSessionsForGame(client, 'game-1', 'user-1');

        expect(eqGameIdSpy).toHaveBeenCalledWith('game_id', 'game-1');
        expect(eqUserIdSpy).toHaveBeenCalledWith('user_id', 'user-1');
        expect(result).toEqual([
            { id: 's1', title: 'Apertura', lastMessageAt: '2026-08-02T10:00:00Z', createdAt: '2026-08-02T09:00:00Z' },
        ]);
    });

    it('lancia SessionError se la query fallisce', async () => {
        const { client } = mockSupabaseSelect({ data: null, error: { message: 'connection refused' } });

        await expect(listSessionsForGame(client, 'game-1', 'user-1')).rejects.toThrow(SessionError);
    });
});

describe('setSessionTitle', () => {
    it('aggiorna titolo e last_message_at della sessione', async () => {
        const { client, updateSpy, eqSpy } = mockSupabaseUpdate({ error: null });

        await setSessionTitle(client, 'session-abc', 'Regole di apertura');

        expect(updateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Regole di apertura', last_message_at: expect.any(String) }),
        );
        expect(eqSpy).toHaveBeenCalledWith('id', 'session-abc');
    });

    it('lancia SessionError se l\'update fallisce', async () => {
        const { client } = mockSupabaseUpdate({ error: { message: 'connection refused' } });

        await expect(setSessionTitle(client, 'session-abc', 'Titolo')).rejects.toThrow(SessionError);
    });
});

describe('deleteSession', () => {
    function mockSupabaseDelete(result: { data: unknown | null; error: { message: string } | null }): {
        client: SupabaseClient;
        eqIdSpy: ReturnType<typeof vi.fn>;
        eqUserIdSpy: ReturnType<typeof vi.fn>;
    } {
        const singleSpy = vi.fn(async () => result);
        const selectSpy = vi.fn(() => ({ single: singleSpy }));
        const eqUserIdSpy = vi.fn(() => ({ select: selectSpy }));
        const eqIdSpy = vi.fn(() => ({ eq: eqUserIdSpy }));
        const deleteSpy = vi.fn(() => ({ eq: eqIdSpy }));
        const client = {
            from: () => ({ delete: deleteSpy }),
        } as unknown as SupabaseClient;

        return { client, eqIdSpy, eqUserIdSpy };
    }

    it('elimina filtrando esplicitamente per id e user_id (non solo via RLS/service client)', async () => {
        const { client, eqIdSpy, eqUserIdSpy } = mockSupabaseDelete({ data: { id: 'session-abc' }, error: null });

        await deleteSession(client, 'session-abc', 'user-1');

        expect(eqIdSpy).toHaveBeenCalledWith('id', 'session-abc');
        expect(eqUserIdSpy).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('lancia SessionError se nessuna riga viene eliminata (id inesistente o di un altro utente)', async () => {
        const { client } = mockSupabaseDelete({ data: null, error: null });

        await expect(deleteSession(client, 'session-abc', 'user-1')).rejects.toThrow(SessionError);
    });

    it('lancia SessionError se il delete fallisce', async () => {
        const { client } = mockSupabaseDelete({ data: null, error: { message: 'connection refused' } });

        await expect(deleteSession(client, 'session-abc', 'user-1')).rejects.toThrow(SessionError);
    });
});

describe('touchSessionLastMessage', () => {
    it('aggiorna solo last_message_at, senza toccare il titolo', async () => {
        const { client, updateSpy, eqSpy } = mockSupabaseUpdate({ error: null });

        await touchSessionLastMessage(client, 'session-abc');

        const updateArg = updateSpy.mock.calls[0]?.[0];
        expect(updateArg).toHaveProperty('last_message_at');
        expect(updateArg).not.toHaveProperty('title');
        expect(eqSpy).toHaveBeenCalledWith('id', 'session-abc');
    });

    it('lancia SessionError se l\'update fallisce', async () => {
        const { client } = mockSupabaseUpdate({ error: { message: 'connection refused' } });

        await expect(touchSessionLastMessage(client, 'session-abc')).rejects.toThrow(SessionError);
    });
});
