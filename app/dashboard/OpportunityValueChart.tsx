'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS: Record<string, string> = {
  Revenue: '#6366f1', Efficiency: '#10b981', Capacity: '#f59e0b',
  Cost: '#ef4444', Retention: '#8b5cf6', default: '#6b7280'
};

type Props = { data: { type: string; value: number }[] };

export function OpportunityValueChart({ data }: Props) {
  if (!data.length) return null;
  const fmt = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Opportunity Value by Category</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <XAxis dataKey="type" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Tooltip formatter={(v: any) => fmt(Number(v))} />
          <Bar dataKey="value" radius={[6,6,0,0]}>
            {data.map((entry) => (
              <Cell key={entry.type} fill={COLORS[entry.type] ?? COLORS.default} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
