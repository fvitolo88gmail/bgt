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

export interface InteractionDetail {
    userRequestId: string;
    gameId: string;
    userId: string | null;
    mode: UserRequestCostRow['mode'];
    status: UserRequestCostRow['status'];
    createdAt: string;
    totalCostUsd: number;
    models: string[]; // nomi modello distinti coinvolti nell'interazione
}

/**
 * Unisce le interazioni (`user_request_costs`) al dettaglio per chiamata
 * (`gemini_calls_costed`) per ottenere, per ogni interazione, l'elenco dei
 * modelli coinvolti — usato per il dettaglio espanso delle tabelle di
 * distribuzione (per gioco/per utente) nel pannello admin.
 */
export function buildInteractionDetails(
    requestRows: UserRequestCostRow[],
    callRows: GeminiCallCostRow[],
): InteractionDetail[] {
    const modelsByRequest = new Map<string, Set<string>>();
    for (const call of callRows) {
        const models = modelsByRequest.get(call.userRequestId) ?? new Set<string>();
        models.add(call.modelName);
        modelsByRequest.set(call.userRequestId, models);
    }

    return requestRows.map((row) => ({
        userRequestId: row.userRequestId,
        gameId: row.gameId,
        userId: row.userId,
        mode: row.mode,
        status: row.status,
        createdAt: row.createdAt,
        totalCostUsd: row.totalCostUsd,
        models: [...(modelsByRequest.get(row.userRequestId) ?? [])],
    }));
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
