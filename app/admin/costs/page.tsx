import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { isAdmin } from '@/lib/profile/repository/profiles.repository';
import { getUserRequestCosts, getGeminiCallCosts } from '@/lib/billing/repository/usage-tracking.repository';
import {
    summarizeOverallCost,
    summarizeCostByGame,
    summarizeCostByUser,
    summarizeCostByCallType,
    summarizeCostByDay,
} from '@/lib/billing/service/billing-aggregation';
import { AdminShell } from '@/components/admin/AdminShell';
import { CostTrendChart } from '@/components/admin/CostTrendChart';
import { CostTable, type CostTableRow } from '@/components/admin/CostTable';

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

// Etichette leggibili per i call_type interni (v. schema gemini_calls) —
// il valore grezzo (es. "query_contextualization") resta nel DB/nel codice,
// solo la UI lo traduce.
const CALL_TYPE_LABELS: Record<string, string> = {
    embedding: 'Embedding',
    generation: 'Generazione',
    query_contextualization: 'Contestualizzazione query',
    query_enhancement: 'Query enhancement',
    reranking: 'Reranking',
};

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
    const byCallType = summarizeCostByCallType(callRows);
    const byDay = summarizeCostByDay(requestRows);

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
        countLabel: 'Interazioni',
        count: g.interactionCount,
        totalCostUsd: g.totalCostUsd,
        avgCostUsd: g.avgCostPerQueryUsd,
    }));

    const byUserRows: CostTableRow[] = byUser.map((u) => ({
        key: u.userId,
        label: userLabelById.get(u.userId) ?? u.userId.slice(0, 8),
        countLabel: 'Interazioni',
        count: u.interactionCount,
        totalCostUsd: u.totalCostUsd,
        avgCostUsd: u.avgCostPerQueryUsd,
    }));

    const byCallTypeRows: CostTableRow[] = byCallType.map((c) => ({
        key: c.callType,
        label: CALL_TYPE_LABELS[c.callType] ?? c.callType,
        countLabel: 'Chiamate',
        count: c.callCount,
        totalCostUsd: c.totalCostUsd,
        avgCostUsd: c.avgCostPerCallUsd,
    }));

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
                        <CostTable rows={byGameRows} labelHeader="Gioco" />
                    </div>

                    <p className="mb-2.5 text-xs font-bold text-ink-soft">Distribuzione per utente</p>
                    <div className="mb-6">
                        <CostTable rows={byUserRows} labelHeader="Utente" />
                    </div>

                    <p className="mb-2.5 text-xs font-bold text-ink-soft">Distribuzione per tipo di operazione</p>
                    <div className="mb-6">
                        <CostTable rows={byCallTypeRows} labelHeader="Operazione" />
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
