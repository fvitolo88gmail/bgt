import { InfoTooltip } from './InfoTooltip';

export interface CostTableRow {
    key: string;
    label: string;
    infoText?: string; // solo per la tabella per tipo di operazione: spiegazione dell'operazione
    model?: string; // solo per la tabella per tipo di operazione: modello usato per quella riga
    countLabel: string; // "Interazioni" o "Chiamate": l'unità conteggiata varia per tabella
    count: number;
    totalCostUsd: number;
    avgCostUsd: number;
}

function formatUsd(value: number): string {
    return `$${value.toFixed(6)}`;
}

/**
 * Tabella di distribuzione dei costi (per gioco, utente o tipo di
 * operazione) — stesso markup, un'unica implementazione. Server Component:
 * nessuna interazione client, solo rendering di dati già aggregati. La
 * colonna modello compare solo se almeno una riga la valorizza.
 */
export function CostTable({ rows, labelHeader }: { rows: CostTableRow[]; labelHeader: string }) {
    const hasModelColumn = rows.some((r) => r.model !== undefined);

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                        <th className="px-2.5 py-2 font-semibold">{labelHeader}</th>
                        {hasModelColumn && <th className="px-2.5 py-2 font-semibold">Modello</th>}
                        <th className="px-2.5 py-2 font-semibold">{rows[0]?.countLabel ?? 'Conteggio'}</th>
                        <th className="px-2.5 py-2 font-semibold">Costo totale</th>
                        <th className="px-2.5 py-2 font-semibold">Costo medio</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.key} className="border-t border-line-soft bg-card">
                            <td className="px-2.5 py-2.5 font-semibold text-ink">
                                {r.label}
                                {r.infoText && <InfoTooltip text={r.infoText} />}
                            </td>
                            {hasModelColumn && (
                                <td className="px-2.5 py-2.5 font-mono text-ink-soft">{r.model ?? '—'}</td>
                            )}
                            <td className="px-2.5 py-2.5 font-mono text-ink-soft">{r.count}</td>
                            <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(r.totalCostUsd)}</td>
                            <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(r.avgCostUsd)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
