import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMessagesForDisplay, ChatHistoryError } from '../../../chat/repository/chat-history.repository';

function mockSupabaseSelect(result: { data: unknown[] | null; error: { message: string } | null }): {
    client: SupabaseClient;
    eqSpy: ReturnType<typeof vi.fn>;
} {
    const orderSpy = vi.fn(async () => result);
    const eqSpy = vi.fn(() => ({ order: orderSpy }));
    const selectSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = {
        from: () => ({ select: selectSpy }),
    } as unknown as SupabaseClient;

    return { client, eqSpy };
}

describe('fetchMessagesForDisplay', () => {
    it('mappa i messaggi in ordine cronologico con id e feedback', async () => {
        const { client, eqSpy } = mockSupabaseSelect({
            data: [
                { id: 'm1', role: 'user', content: 'Come si muove il treno?', feedback: null },
                { id: 'm2', role: 'assistant', content: 'Si muove di 2 caselle.', feedback: 'good' },
            ],
            error: null,
        });

        const result = await fetchMessagesForDisplay(client, 'session-1');

        expect(eqSpy).toHaveBeenCalledWith('session_id', 'session-1');
        expect(result).toEqual([
            { id: 'm1', role: 'user', content: 'Come si muove il treno?', feedback: null },
            { id: 'm2', role: 'assistant', content: 'Si muove di 2 caselle.', feedback: 'good' },
        ]);
    });

    it('normalizza un ruolo sconosciuto a "user" e un feedback non valido a null', async () => {
        const { client } = mockSupabaseSelect({
            data: [{ id: 'm1', role: 'system', content: 'x', feedback: 'maybe' }],
            error: null,
        });

        const result = await fetchMessagesForDisplay(client, 'session-1');

        expect(result).toEqual([{ id: 'm1', role: 'user', content: 'x', feedback: null }]);
    });

    it('lancia ChatHistoryError se la query fallisce', async () => {
        const { client } = mockSupabaseSelect({ data: null, error: { message: 'connection refused' } });

        await expect(fetchMessagesForDisplay(client, 'session-1')).rejects.toThrow(ChatHistoryError);
    });
});
