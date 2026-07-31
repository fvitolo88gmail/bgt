import { describe, it, expect } from 'vitest';
import { summarizeOverallCost, summarizeCostByGame, summarizeCostByDay } from './billing-aggregation';
import type { UserRequestCostRow } from './repositories/usage-tracking.repository';

function row(overrides: Partial<UserRequestCostRow>): UserRequestCostRow {
    return {
        userRequestId: 'req-1',
        gameId: 'game-a',
        mode: 'qa',
        status: 'success',
        createdAt: '2026-07-30T23:46:53.000Z',
        totalCostUsd: 0.005,
        ...overrides,
    };
}

describe('summarizeOverallCost', () => {
    it('calcola il costo medio come totale/numero di interazioni', () => {
        const rows = [row({ totalCostUsd: 0.005 }), row({ totalCostUsd: 0.015 })];
        expect(summarizeOverallCost(rows)).toEqual({
            interactionCount: 2,
            totalCostUsd: 0.02,
            avgCostPerQueryUsd: 0.01,
        });
    });

    it('non divide per zero su lista vuota', () => {
        expect(summarizeOverallCost([])).toEqual({
            interactionCount: 0,
            totalCostUsd: 0,
            avgCostPerQueryUsd: 0,
        });
    });
});

describe('summarizeCostByGame', () => {
    it('raggruppa per game_id e ordina per costo totale decrescente', () => {
        const rows = [
            row({ gameId: 'brass', totalCostUsd: 0.001 }),
            row({ gameId: 'hegemony', totalCostUsd: 0.01 }),
            row({ gameId: 'brass', totalCostUsd: 0.002 }),
        ];
        const result = summarizeCostByGame(rows);
        expect(result).toEqual([
            { gameId: 'hegemony', interactionCount: 1, totalCostUsd: 0.01, avgCostPerQueryUsd: 0.01 },
            { gameId: 'brass', interactionCount: 2, totalCostUsd: 0.003, avgCostPerQueryUsd: 0.0015 },
        ]);
    });
});

describe('summarizeCostByDay', () => {
    it('raggruppa per giorno UTC in ordine cronologico', () => {
        const rows = [
            row({ createdAt: '2026-07-31T10:00:00.000Z', totalCostUsd: 0.002 }),
            row({ createdAt: '2026-07-30T23:46:53.000Z', totalCostUsd: 0.005 }),
            row({ createdAt: '2026-07-31T18:00:00.000Z', totalCostUsd: 0.003 }),
        ];
        expect(summarizeCostByDay(rows)).toEqual([
            { date: '2026-07-30', totalCostUsd: 0.005, interactionCount: 1 },
            { date: '2026-07-31', totalCostUsd: 0.005, interactionCount: 2 },
        ]);
    });
});
