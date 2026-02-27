'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Props = { data: { name: string; score: number }[] };

function barColor(score: number) {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 40) return '#eab308';
  return '#22c55e';
}

export function EntityScoreChart({ data }: Props) {
  if (!data.length) return null;
  const truncate = (s: string) => s.length > 22 ? s.slice(0, 22) + '\u2026' : s;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Entities by Opportunity Score</h3>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 28)}>
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tickFormatter={truncate} tick={{ fontSize: 11 }} width={130} />
          <Tooltip />
          <Bar dataKey="score" radius={[0,6,6,0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={barColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
