'use client';

import { Fragment, useState } from 'react';
import { getCallTypeLabel, getCallTypeDescription } from '@/lib/billing/service/call-type-labels';
import { InfoTooltip } from './InfoTooltip';

export interface TopRequestRow {
    userRequestId: string;
    userLabel: string;
    gameLabel: string;
    mode: string;
    status: string;
    createdAt: string;
    totalCostUsd: number;
}

export interface RequestCallDetail {
    callType: string;
    modelName: string;
    costUsd: number;
}

function formatUsd(value: number): string {
    return `$${value.toFixed(6)}`;
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString('it-IT');
}

/**
 * Top N domande utente per costo, riga espandibile al click per vedere le
 * singole chiamate Gemini che la compongono (tipo operazione, modello,
 * costo) — a differenza delle tabelle di distribuzione (gioco/utente/tipo
 * operazione), qui la riga è la singola interazione, non un aggregato.
 */
export function TopRequestsTable({
    rows,
    detailsByRequestId,
}: {
    rows: TopRequestRow[];
    detailsByRequestId: Record<string, RequestCallDetail[]>;
}) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                        <th className="px-2.5 py-2 font-semibold">Data</th>
                        <th className="px-2.5 py-2 font-semibold">Utente</th>
                        <th className="px-2.5 py-2 font-semibold">Gioco</th>
                        <th className="px-2.5 py-2 font-semibold">Costo totale</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const isExpanded = expandedId === r.userRequestId;
                        const details = detailsByRequestId[r.userRequestId] ?? [];
                        return (
                            <Fragment key={r.userRequestId}>
                                <tr
                                    onClick={() => setExpandedId(isExpanded ? null : r.userRequestId)}
                                    className="cursor-pointer border-t border-line-soft bg-card hover:bg-line-soft/40"
                                >
                                    <td className="px-2.5 py-2.5 font-mono text-ink-soft">
                                        <span className="mr-1.5 inline-block w-3 text-ink-faint">
                                            {isExpanded ? '▾' : '▸'}
                                        </span>
                                        {formatDateTime(r.createdAt)}
                                    </td>
                                    <td className="px-2.5 py-2.5 font-semibold text-ink">{r.userLabel}</td>
                                    <td className="px-2.5 py-2.5 text-ink-soft">{r.gameLabel}</td>
                                    <td className="px-2.5 py-2.5 font-mono text-ink-soft">{formatUsd(r.totalCostUsd)}</td>
                                </tr>
                                {isExpanded && (
                                    <tr className="border-t border-line-soft bg-paper">
                                        <td colSpan={4} className="px-2.5 py-2">
                                            <table className="w-full border-collapse text-[11.5px]">
                                                <thead>
                                                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                                                        <th className="px-2 py-1.5 font-semibold">Operazione</th>
                                                        <th className="px-2 py-1.5 font-semibold">Modello</th>
                                                        <th className="px-2 py-1.5 font-semibold">Costo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {details.map((d, i) => (
                                                        <tr key={`${d.callType}-${i}`} className="border-t border-line-soft">
                                                            <td className="px-2 py-1.5 text-ink-soft">
                                                                {getCallTypeLabel(d.callType)}
                                                                {getCallTypeDescription(d.callType) && (
                                                                    <InfoTooltip text={getCallTypeDescription(d.callType)!} />
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-1.5 font-mono text-ink-soft">{d.modelName}</td>
                                                            <td className="px-2 py-1.5 font-mono text-ink-soft">
                                                                {formatUsd(d.costUsd)}
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
