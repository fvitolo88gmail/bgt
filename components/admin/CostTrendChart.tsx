'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyCostPoint } from '@/lib/billing/service/billing-aggregation';

// Client Component isolato: recharts non può girare in un Server Component.
// La pagina (app/admin/costs/page.tsx) resta server-side per il fetch/gate admin.
export function CostTrendChart({ data }: { data: DailyCostPoint[] }) {
    return (
        <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" />
                <XAxis dataKey="date" stroke="var(--ink-soft)" fontSize={12} />
                <YAxis
                    stroke="var(--ink-soft)"
                    fontSize={12}
                    tickFormatter={(value: number) => `$${value.toFixed(4)}`}
                />
                <Tooltip
                    formatter={(value) => [`$${Number(value).toFixed(6)}`, 'Costo']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }}
                />
                <Line type="monotone" dataKey="totalCostUsd" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
        </ResponsiveContainer>
    );
}
