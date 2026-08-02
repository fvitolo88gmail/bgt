import { describe, it, expect } from 'vitest';
import {
    summarizeOverallCost,
    summarizeCostByGame,
    summarizeCostByUser,
    summarizeCostByDay,
    summarizeCostByCallType,
} from '../../../billing/service/billing-aggregation';
import type { UserRequestCostRow, GeminiCallCostRow } from '../../../billing/repository/usage-tracking.repository';

function row(overrides: Partial<UserRequestCostRow>): UserRequestCostRow {
    return {
        userRequestId: 'req-1',
        gameId: 'game-a',
        userId: 'user-a',
        mode: 'qa',
        status: 'success',
        createdAt: '2026-07-30T23:46:53.000Z',
        totalCostUsd: 0.005,
        ...overrides,
    };
}

function callRow(overrides: Partial<GeminiCallCostRow>): GeminiCallCostRow {
    return {
        userRequestId: 'req-1',
        callType: 'generation',
        modelName: 'gemini-3.1-flash-lite',
        costUsd: 0.003,
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

describe('summarizeCostByUser', () => {
    it('raggruppa per user_id e ordina per costo totale decrescente', () => {
        const rows = [
            row({ userId: 'alice', totalCostUsd: 0.001 }),
            row({ userId: 'bob', totalCostUsd: 0.01 }),
            row({ userId: 'alice', totalCostUsd: 0.002 }),
        ];
        expect(summarizeCostByUser(rows)).toEqual([
            { userId: 'bob', interactionCount: 1, totalCostUsd: 0.01, avgCostPerQueryUsd: 0.01 },
            { userId: 'alice', interactionCount: 2, totalCostUsd: 0.003, avgCostPerQueryUsd: 0.0015 },
        ]);
    });

    it('esclude le interazioni senza user_id risolto', () => {
        const rows = [row({ userId: null, totalCostUsd: 0.005 })];
        expect(summarizeCostByUser(rows)).toEqual([]);
    });
});

describe('summarizeCostByCallType', () => {
    it('raggruppa per call_type e ordina per costo totale decrescente', () => {
        const callRows = [
            callRow({ callType: 'embedding', costUsd: 0.001 }),
            callRow({ callType: 'generation', costUsd: 0.01 }),
            callRow({ callType: 'embedding', costUsd: 0.002 }),
        ];
        expect(summarizeCostByCallType(callRows)).toEqual([
            { callType: 'generation', callCount: 1, totalCostUsd: 0.01, avgCostPerCallUsd: 0.01 },
            { callType: 'embedding', callCount: 2, totalCostUsd: 0.003, avgCostPerCallUsd: 0.0015 },
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
