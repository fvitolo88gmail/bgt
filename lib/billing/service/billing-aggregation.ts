/**
 * Aggregazioni pure per il pannello admin costi, a partire dalle righe già
 * sommate per interazione (`getUserRequestCosts`). Separate
 * dalla lettura DB per essere testabili senza un client Supabase — il
 * volume di dati è ancora troppo piccolo per giustificare RPC dedicate per
 * ogni aggregazione, quindi si fa qui in JS.
 */

import type { UserRequestCostRow, GeminiCallCostRow } from '../repository/usage-tracking.repository';

export interface OverallCostSummary {
    interactionCount: number;
    totalCostUsd: number;
    avgCostPerQueryUsd: number;
}

export function summarizeOverallCost(rows: UserRequestCostRow[]): OverallCostSummary {
    const interactionCount = rows.length;
    const totalCostUsd = rows.reduce((sum, row) => sum + row.totalCostUsd, 0);
    return {
        interactionCount,
        totalCostUsd,
        avgCostPerQueryUsd: interactionCount > 0 ? totalCostUsd / interactionCount : 0,
    };
}

export interface GameCostSummary {
    gameId: string;
    interactionCount: number;
    totalCostUsd: number;
    avgCostPerQueryUsd: number;
}

/**
 * Una riga per game_id, ordinata per costo totale decrescente (i giochi più
 * costosi per primi — la vista più utile per capire dove va il budget).
 */
export function summarizeCostByGame(rows: UserRequestCostRow[]): GameCostSummary[] {
    const byGame = new Map<string, { interactionCount: number; totalCostUsd: number }>();

    for (const row of rows) {
        const existing = byGame.get(row.gameId) ?? { interactionCount: 0, totalCostUsd: 0 };
        existing.interactionCount += 1;
        existing.totalCostUsd += row.totalCostUsd;
        byGame.set(row.gameId, existing);
    }

    return [...byGame.entries()]
        .map(([gameId, stats]) => ({
            gameId,
            interactionCount: stats.interactionCount,
            totalCostUsd: stats.totalCostUsd,
            avgCostPerQueryUsd: stats.totalCostUsd / stats.interactionCount,
        }))
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

export interface UserCostSummary {
    userId: string;
    interactionCount: number;
    totalCostUsd: number;
    avgCostPerQueryUsd: number;
}

/**
 * Una riga per user_id, stesso criterio di ordinamento di
 * `summarizeCostByGame`. Interazioni senza utente risolto (user_id null,
 * non dovrebbe succedere con AUTH-00011 attivo ma lo schema lo permette)
 * sono escluse, non raggruppate sotto una chiave fittizia.
 */
export function summarizeCostByUser(rows: UserRequestCostRow[]): UserCostSummary[] {
    const byUser = new Map<string, { interactionCount: number; totalCostUsd: number }>();

    for (const row of rows) {
        if (!row.userId) continue;
        const existing = byUser.get(row.userId) ?? { interactionCount: 0, totalCostUsd: 0 };
        existing.interactionCount += 1;
        existing.totalCostUsd += row.totalCostUsd;
        byUser.set(row.userId, existing);
    }

    return [...byUser.entries()]
        .map(([userId, stats]) => ({
            userId,
            interactionCount: stats.interactionCount,
            totalCostUsd: stats.totalCostUsd,
            avgCostPerQueryUsd: stats.totalCostUsd / stats.interactionCount,
        }))
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

export interface CallTypeCostSummary {
    callType: GeminiCallCostRow['callType'];
    callCount: number;
    totalCostUsd: number;
    avgCostPerCallUsd: number;
}

/**
 * Una riga per call_type (embedding, generation, query_contextualization,
 * query_enhancement, reranking), ordinata per costo totale decrescente —
 * a differenza delle altre viste, la base è `gemini_calls_costed` (una riga
 * per chiamata), non `user_request_costs` (una riga per interazione): qui
 * interessa il costo per singola chiamata, non per interazione utente.
 */
export function summarizeCostByCallType(callRows: GeminiCallCostRow[]): CallTypeCostSummary[] {
    const byCallType = new Map<string, { callCount: number; totalCostUsd: number }>();

    for (const call of callRows) {
        const existing = byCallType.get(call.callType) ?? { callCount: 0, totalCostUsd: 0 };
        existing.callCount += 1;
        existing.totalCostUsd += call.costUsd;
        byCallType.set(call.callType, existing);
    }

    return [...byCallType.entries()]
        .map(([callType, stats]) => ({
            callType: callType as GeminiCallCostRow['callType'],
            callCount: stats.callCount,
            totalCostUsd: stats.totalCostUsd,
            avgCostPerCallUsd: stats.totalCostUsd / stats.callCount,
        }))
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

export interface DailyCostPoint {
    date: string; // YYYY-MM-DD, UTC
    totalCostUsd: number;
    interactionCount: number;
}

/**
 * Bucket per giorno UTC (non locale: created_at è timestamptz, un bucket
 * stabile indipendente dal fuso di chi guarda il pannello), ordinato
 * cronologicamente.
 */
export function summarizeCostByDay(rows: UserRequestCostRow[]): DailyCostPoint[] {
    const byDay = new Map<string, { totalCostUsd: number; interactionCount: number }>();

    for (const row of rows) {
        const date = row.createdAt.slice(0, 10); // "YYYY-MM-DDTHH:..." → "YYYY-MM-DD"
        const existing = byDay.get(date) ?? { totalCostUsd: 0, interactionCount: 0 };
        existing.totalCostUsd += row.totalCostUsd;
        existing.interactionCount += 1;
        byDay.set(date, existing);
    }

    return [...byDay.entries()]
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
