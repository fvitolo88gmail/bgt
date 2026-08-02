import { describe, it, expect, vi } from 'vitest';
import { generateSessionTitle } from '../../../chat/service/title-generation';
import { geminiClient } from '../../../shared/gemini';

vi.mock('../../../shared/gemini', () => ({
    geminiClient: { generate: vi.fn() },
}));

describe('generateSessionTitle', () => {
    it('restituisce il titolo generato, propagando userRequestId per il tracking costi', async () => {
        vi.mocked(geminiClient.generate).mockResolvedValueOnce('Movimento delle unità');

        const result = await generateSessionTitle('Come si muovono le unità?', 'Si muovono di una casella...', 'req-1');

        expect(result).toBe('Movimento delle unità');
        expect(geminiClient.generate).toHaveBeenCalledWith(
            expect.any(String),
            { userRequestId: 'req-1', callType: 'title_generation' },
        );
    });

    it('non passa context se userRequestId è assente (nessun tracking senza user_request)', async () => {
        vi.mocked(geminiClient.generate).mockResolvedValueOnce('Titolo');

        await generateSessionTitle('domanda', 'risposta');

        expect(geminiClient.generate).toHaveBeenCalledWith(expect.any(String), undefined);
    });

    it('rimuove virgolette superflue e tronca a TITLE_MAX_LENGTH', async () => {
        const longTitle = `"${'parola '.repeat(20)}"`;
        vi.mocked(geminiClient.generate).mockResolvedValueOnce(longTitle);

        const result = await generateSessionTitle('domanda', 'risposta', 'req-1');

        expect(result).not.toBeNull();
        expect(result?.startsWith('"')).toBe(false);
        expect(result!.length).toBeLessThanOrEqual(80);
    });

    it('fail-soft: restituisce null se la generazione fallisce', async () => {
        vi.mocked(geminiClient.generate).mockRejectedValueOnce(new Error('quota exceeded'));

        const result = await generateSessionTitle('domanda', 'risposta', 'req-1');

        expect(result).toBeNull();
    });

    it('fail-soft: restituisce null se il titolo generato è vuoto', async () => {
        vi.mocked(geminiClient.generate).mockResolvedValueOnce('   ');

        const result = await generateSessionTitle('domanda', 'risposta', 'req-1');

        expect(result).toBeNull();
    });
});
