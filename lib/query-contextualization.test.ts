import { describe, it, expect, vi } from 'vitest';
import { contextualizeQueryForRetrieval } from './query-contextualization';
import { geminiClient } from './gemini';
import type { ConversationTurn } from './prompt';

vi.mock('./gemini', () => ({
    geminiClient: { generate: vi.fn() },
}));

describe('contextualizeQueryForRetrieval', () => {
    it('restituisce la domanda originale invariata se non c\'è history', async () => {
        const result = await contextualizeQueryForRetrieval('Cos\'è il mercato estero?', []);
        expect(result).toBe('Cos\'è il mercato estero?');
        expect(geminiClient.generate).not.toHaveBeenCalled();
    });

    it('riscrive la domanda usando la history quando presente', async () => {
        vi.mocked(geminiClient.generate).mockResolvedValueOnce(
            'Dimmi di più sul thread Can the state class not sell services to foreign market',
        );

        const history: ConversationTurn[] = [
            { role: 'user', content: 'Come si ottiene Salute dal mercato estero?' },
            { role: 'assistant', content: 'Vedi il thread «Can the state class not sell services to foreign market?»...' },
        ];

        const result = await contextualizeQueryForRetrieval('dimmi di più su questo thread', history);

        expect(result).toBe('Dimmi di più sul thread Can the state class not sell services to foreign market');
        expect(geminiClient.generate).toHaveBeenCalledOnce();
    });

    it('rimuove eventuali virgolette superflue attorno alla riscrittura', async () => {
        vi.mocked(geminiClient.generate).mockResolvedValueOnce('"Domanda riscritta"');

        const result = await contextualizeQueryForRetrieval('follow-up', [
            { role: 'user', content: 'domanda precedente' },
        ]);

        expect(result).toBe('Domanda riscritta');
    });

    it('fail-soft: torna alla domanda originale se la riscrittura fallisce', async () => {
        vi.mocked(geminiClient.generate).mockRejectedValueOnce(new Error('quota exceeded'));

        const result = await contextualizeQueryForRetrieval('follow-up', [
            { role: 'user', content: 'domanda precedente' },
        ]);

        expect(result).toBe('follow-up');
    });

    it('fail-soft: torna alla domanda originale se la riscrittura è vuota', async () => {
        vi.mocked(geminiClient.generate).mockResolvedValueOnce('   ');

        const result = await contextualizeQueryForRetrieval('follow-up', [
            { role: 'user', content: 'domanda precedente' },
        ]);

        expect(result).toBe('follow-up');
    });
});
