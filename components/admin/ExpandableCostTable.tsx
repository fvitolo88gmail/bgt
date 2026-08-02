'use client';

import { Fragment, useState } from 'react';

export interface CostTableRow {
    key: string;
    label: string;
    interactionCount: number;
    totalCostUsd: number;
    avgCostPerQueryUsd: number;
}

export interface InteractionDetailRow {
    userRequestId: string;
    createdAt: string;
    mode: string;
    status: string;
    totalCostUsd: number;
    models: string[];
}

function formatUsd(value: number): string {
    return `$${value.toFixed(6)}`;
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString('it-IT');
}

/**
 * Tabella di distribuzione (per gioco o per utente) con righe espandibili:
 * al click su una riga si apre l'elenco delle interazioni che la compongono,
 * ciascuna con il/i modello/i coinvolto/i — una interazione può usare più
 * modelli (es. embedding + generazione), quindi il modello vive solo qui,
 * non nella riga aggregata.
 */
export function ExpandableCostTable({
    rows,
    detailsByKey,
    labelHeader,
}: {
    rows: CostTableRow[];
    detailsByKey: Record<string, InteractionDetailRow[]>;
    labelHeader: string;
}) {
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                        <th className="px-2.5 py-2 font-semibold">{labelHeader}</th>
                        <th className="px-2.5 py-2 font-semibold">Interazioni</th>
                        <th className="px-2.5 py-2 font-semibold">Costo totale</th>
                        <th className="px-2.5 py-2 font-semibold">Costo medio</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const isExpanded = expandedKey === r.key;
                        const details = detailsByKey[r.key] ?? [];
        return (
                            <Fragment key={r.key}>
                                <tr
                                    onClick={() => setExpandedKey(isExpanded ? null : r.key)}
                                    className="cursor-pointer border-t border-line-soft bg-card hover:bg-line-soft/40"
                                >
                                    <td className="px-2.5 py-2.5 font-semibold text-ink">
                                        <span className="mr-1.5 inline-block w-3 text-ink-faint">
                                            {isExpanded ? '▾' : '▸'}
                                        </span>
                                        {r.label}
                                    </td>
                                    <td className="px-2.5 py-2.5 font-mono text-ink-soft">{r.interactionCount}</td>
                                    <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(r.totalCostUsd)}</td>
                                    <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(r.avgCostPerQueryUsd)}</td>
                                </tr>
                                {isExpanded && (
                                    <tr key={`${r.key}-detail`} className="border-t border-line-soft bg-paper">
                                        <td colSpan={4} className="px-2.5 py-2">
                                            <table className="w-full border-collapse text-[11.5px]">
                                                <thead>
                                                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                                                        <th className="px-2 py-1.5 font-semibold">Data</th>
                                                        <th className="px-2 py-1.5 font-semibold">Modalità</th>
                                                        <th className="px-2 py-1.5 font-semibold">Modello/i</th>
                                                        <th className="px-2 py-1.5 font-semibold">Stato</th>
                                                        <th className="px-2 py-1.5 font-semibold">Costo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {details.map((d) => (
                                                        <tr key={d.userRequestId} className="border-t border-line-soft">
                                                            <td className="px-2 py-1.5 font-mono text-ink-soft">
                                                                {formatDateTime(d.createdAt)}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-ink-soft">{d.mode}</td>
                                                            <td className="px-2 py-1.5 text-ink-soft">
                                                                {d.models.length > 0 ? d.models.join(', ') : '—'}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-ink-soft">{d.status}</td>
                                                            <td className="px-2 py-1.5 font-mono text-ink-soft">
                                                                {formatUsd(d.totalCostUsd)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
