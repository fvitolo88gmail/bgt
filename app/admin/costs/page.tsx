import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { isAdmin } from '@/lib/profile/repository/profiles.repository';
import { getUserRequestCosts, getGeminiCallCosts } from '@/lib/billing/repository/usage-tracking.repository';
import {
    summarizeOverallCost,
    summarizeCostByGame,
    summarizeCostByUser,
    summarizeCostByDay,
    buildInteractionDetails,
    type InteractionDetail,
} from '@/lib/billing/service/billing-aggregation';
import { AdminShell } from '@/components/admin/AdminShell';
import { CostTrendChart } from '@/components/admin/CostTrendChart';
import { ExpandableCostTable, type CostTableRow, type InteractionDetailRow } from '@/components/admin/ExpandableCostTable';

function formatUsd(value: number): string {
    return `$${value.toFixed(6)}`;
}

function KpiCard({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
    return (
        <div className="rounded-md border border-line bg-card p-4">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
            <p className={`font-mono text-2xl font-medium text-ink ${valueClassName}`}>{value}</p>
        </div>
    );
}

function toDetailRow(d: InteractionDetail): InteractionDetailRow {
    return {
        userRequestId: d.userRequestId,
        createdAt: d.createdAt,
        mode: d.mode,
        status: d.status,
        totalCostUsd: d.totalCostUsd,
        models: d.models,
    };
}

function groupDetailsBy(details: InteractionDetail[], keyOf: (d: InteractionDetail) => string | null): Record<string, InteractionDetailRow[]> {
    const grouped: Record<string, InteractionDetailRow[]> = {};
    for (const d of details) {
        const key = keyOf(d);
        if (!key) continue;
        (grouped[key] ??= []).push(toDetailRow(d));
    }
    return grouped;
}

export default async function AdminCostsPage() {
    const supabase = await createServerSupabaseClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // proxy.ts garantisce già una sessione valida per /admin/* — qui si
    // verifica il ruolo, non l'autenticazione.
    if (!user || !(await isAdmin(supabase, user.id))) {
        return (
            <AdminShell>
                <p className="text-sm text-ink-soft">Accesso riservato agli admin.</p>
            </AdminShell>
        );
    }

    const [requestRows, callRows] = await Promise.all([getUserRequestCosts(supabase), getGeminiCallCosts(supabase)]);
    const overall = summarizeOverallCost(requestRows);
    const byGame = summarizeCostByGame(requestRows);
    const byUser = summarizeCostByUser(requestRows);
    const byDay = summarizeCostByDay(requestRows);
    const details = buildInteractionDetails(requestRows, callRows);

    const { data: games } = await supabase.from('games').select('id, name');
    const gameNameById = new Map((games ?? []).map((g) => [g.id as string, g.name as string]));

    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name');
    const userLabelById = new Map(
        (profiles ?? []).map((p) => {
            const firstName = p.first_name as string | null;
            const lastName = p.last_name as string | null;
            const name = [firstName, lastName].filter(Boolean).join(' ');
            return [p.id as string, name || (p.id as string).slice(0, 8)];
        }),
    );

    const byGameRows: CostTableRow[] = byGame.map((g) => ({
        key: g.gameId,
        label: gameNameById.get(g.gameId) ?? g.gameId,
        interactionCount: g.interactionCount,
        totalCostUsd: g.totalCostUsd,
        avgCostPerQueryUsd: g.avgCostPerQueryUsd,
    }));
    const detailsByGame = groupDetailsBy(details, (d) => d.gameId);

    const byUserRows: CostTableRow[] = byUser.map((u) => ({
        key: u.userId,
        label: userLabelById.get(u.userId) ?? u.userId.slice(0, 8),
        interactionCount: u.interactionCount,
        totalCostUsd: u.totalCostUsd,
        avgCostPerQueryUsd: u.avgCostPerQueryUsd,
    }));
    const detailsByUser = groupDetailsBy(details, (d) => d.userId);

    return (
        <AdminShell active="Costi">
            <h2 className="mb-1.5 border-b border-line pb-3.5 font-serif text-xl text-ink">Costi</h2>
            <p className="mb-6 text-[13.5px] text-ink-soft">
                Costo proiettato a prezzi Tier 1, calcolato su token realmente consumati
            </p>

            {overall.interactionCount === 0 ? (
                <p className="text-sm text-ink-faint">Nessuna interazione registrata ancora.</p>
            ) : (
                <>
                    <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                        <KpiCard label="Interazioni" value={String(overall.interactionCount)} />
                        <KpiCard label="Costo totale" value={formatUsd(overall.totalCostUsd)} />
                        <KpiCard label="Costo medio / query" value={formatUsd(overall.avgCostPerQueryUsd)} />
                    </div>

                    <p className="mb-2.5 text-xs font-bold text-ink-soft">Distribuzione per gioco</p>
                    <div className="mb-6">
                        <ExpandableCostTable rows={byGameRows} detailsByKey={detailsByGame} labelHeader="Gioco" />
                    </div>

                    <p className="mb-2.5 text-xs font-bold text-ink-soft">Distribuzione per utente</p>
                    <div className="mb-6">
                        <ExpandableCostTable rows={byUserRows} detailsByKey={detailsByUser} labelHeader="Utente" />
                    </div>

                    <p className="mb-2.5 text-xs font-bold text-ink-soft">Andamento nel tempo</p>
                    <div className="rounded-md border border-line bg-card p-4">
                        <CostTrendChart data={byDay} />
                    </div>
                </>
            )}
        </AdminShell>
    );
}
