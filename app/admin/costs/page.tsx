import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/repositories/profiles.repository';
import { getUserRequestCosts } from '@/lib/repositories/usage-tracking.repository';
import { summarizeOverallCost, summarizeCostByGame, summarizeCostByDay } from '@/lib/billing-aggregation';
import { AdminShell } from '@/components/admin/AdminShell';
import { CostTrendChart } from '@/components/admin/CostTrendChart';

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

    const rows = await getUserRequestCosts(supabase);
    const overall = summarizeOverallCost(rows);
    const byGame = summarizeCostByGame(rows);
    const byDay = summarizeCostByDay(rows);

    const { data: games } = await supabase.from('games').select('id, name');
    const gameNameById = new Map((games ?? []).map((g) => [g.id as string, g.name as string]));

    return (
        <AdminShell active="Costi">
            <h2 className="mb-1.5 border-b border-line pb-3.5 font-serif text-xl text-ink">Costi Gemini</h2>
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
                    <div className="mb-6 overflow-x-auto">
                        <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                                    <th className="px-2.5 py-2 font-semibold">Gioco</th>
                                    <th className="px-2.5 py-2 font-semibold">Interazioni</th>
                                    <th className="px-2.5 py-2 font-semibold">Costo totale</th>
                                    <th className="px-2.5 py-2 font-semibold">Costo medio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byGame.map((g) => (
                                    <tr key={g.gameId} className="border-t border-line-soft bg-card">
                                        <td className="px-2.5 py-2.5 font-semibold text-ink">
                                            {gameNameById.get(g.gameId) ?? g.gameId}
                                        </td>
                                        <td className="px-2.5 py-2.5 font-mono text-ink-soft">{g.interactionCount}</td>
                                        <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(g.totalCostUsd)}</td>
                                        <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(g.avgCostPerQueryUsd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
