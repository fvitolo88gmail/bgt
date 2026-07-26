import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyGameIdentity, GameIdentityMismatchError } from './games';

function mockSupabase(result: { data: unknown; error: { message: string } | null }): SupabaseClient {
    const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => result,
    };
    return { from: () => chain } as unknown as SupabaseClient;
}

describe('verifyGameIdentity', () => {
    it('non lancia se bgg_id coincide', async () => {
        const supabase = mockSupabase({ data: { bgg_id: 224517, name: 'Brass Birmingham' }, error: null });
        await expect(verifyGameIdentity(supabase, 'game-uuid', 224517)).resolves.toBeUndefined();
    });

    it('lancia GameIdentityMismatchError se bgg_id non coincide (slug/id di giochi diversi)', async () => {
        const supabase = mockSupabase({ data: { bgg_id: 331104, name: 'Hegemony' }, error: null });
        await expect(verifyGameIdentity(supabase, 'game-uuid', 224517)).rejects.toThrow(
            GameIdentityMismatchError
        );
    });

    it('lancia se il game_id non esiste in games', async () => {
        const supabase = mockSupabase({ data: null, error: null });
        await expect(verifyGameIdentity(supabase, 'game-uuid-inesistente', 224517)).rejects.toThrow(
            GameIdentityMismatchError
        );
    });

    it('lancia se la query fallisce', async () => {
        const supabase = mockSupabase({ data: null, error: { message: 'connection refused' } });
        await expect(verifyGameIdentity(supabase, 'game-uuid', 224517)).rejects.toThrow(
            GameIdentityMismatchError
        );
    });
});
