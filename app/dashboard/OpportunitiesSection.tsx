'use client';

import { useState } from 'react';
import { stripEntityPrefix } from './EntityTable';

interface WhyMetric {
  name: string;
  slug: string;
  unit: string | null;
  category: string | null;
  value: number;
}

interface Opportunity {
  id: number;
  title: string;
  type: string;
  priority: number;
  valueSized: number | null;
  recommendation: string;
  detail: string | null;
  nextSteps: string | null;
  alternatives: string | null;
  entity: {
    id: number;
    canonicalName: string;
    score: { score: number } | null;
  } | null;
  whyMetrics?: WhyMetric[];
}

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatMetricValue(value: number, unit: string | null): string {
  if (unit === 'dollar') return formatDollar(value);
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'days') return `${value.toFixed(1)} days`;
  if (unit === 'count') return Math.round(value).toLocaleString();
  // Heuristic: large numbers are likely dollars, small are rates/percents
  if (value > 1000) return `$${Math.round(value).toLocaleString()}`;
  if (value <= 1 && value >= 0) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString();
}

function oppTypeColor(type: string): string {
  const map: Record<string, string> = {
    Revenue: 'bg-indigo-500',
    Efficiency: 'bg-blue-500',
    Capacity: 'bg-purple-500',
    Cost: 'bg-orange-500',
    Retention: 'bg-teal-500',
  };
  return map[type] || 'bg-gray-400';
}

function oppTypeHeaderColor(type: string): string {
  const map: Record<string, string> = {
    Revenue: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    Efficiency: 'bg-blue-50 border-blue-200 text-blue-700',
    Capacity: 'bg-purple-50 border-purple-200 text-purple-700',
    Cost: 'bg-orange-50 border-orange-200 text-orange-700',
    Retention: 'bg-teal-50 border-teal-200 text-teal-700',
  };
  return map[type] || 'bg-gray-50 border-gray-200 text-gray-700';
}

function parseRole(step: string): { role: string; text: string } {
  const match = step.match(/^\[([^\]]+)\]\s*(.*)/);
  if (match) return { role: match[1], text: match[2] };
  return { role: '', text: step };
}

const ROLE_COLORS: Record<string, string> = {
  'Office Manager': 'bg-violet-100 text-violet-700',
  'Dentist': 'bg-blue-100 text-blue-700',
  'Hygienist': 'bg-teal-100 text-teal-700',
  'ROD': 'bg-orange-100 text-orange-700',
  'Regional': 'bg-orange-100 text-orange-700',
  'Front Desk': 'bg-pink-100 text-pink-700',
  'Billing': 'bg-yellow-100 text-yellow-700',
  'Doctor': 'bg-blue-100 text-blue-700',
};

function roleColor(role: string): string {
  // Check exact match first, then partial
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  for (const [key, val] of Object.entries(ROLE_COLORS)) {
    if (role.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'bg-gray-100 text-gray-600';
}

const TYPE_ORDER = ['Revenue', 'Efficiency', 'Capacity', 'Cost', 'Retention'];
const INITIAL_SHOW = 5;

function OppCard({ opp }: { opp: Opportunity }) {
  const [whyOpen, setWhyOpen] = useState(false);

  let alternatives: string[] = [];
  try { alternatives = opp.alternatives ? JSON.parse(opp.alternatives) : []; } catch {}
  let nextSteps: string[] = [];
  try { nextSteps = opp.nextSteps ? JSON.parse(opp.nextSteps) : []; } catch {}

  const entityName = opp.entity?.canonicalName || '';
  const cleanTitle = stripEntityPrefix(opp.title, entityName);
  const whyMetrics = opp.whyMetrics || [];

  return (
    <details className="group hover:bg-gray-50 transition-colors">
      {/* Summary row */}
      <summary className="flex items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 cursor-pointer list-none">
        <div className="flex-shrink-0 w-16 sm:w-24 text-right">
          <span className="text-base sm:text-xl font-bold text-gray-900">{formatDollar(opp.valueSized)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">{cleanTitle}</div>
          {opp.entity && (
            <div className="text-xs sm:text-sm text-gray-500">{entityName}</div>
          )}
        </div>
        <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      {/* Expanded card body */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-3 sm:pt-4 space-y-4 ml-16 sm:ml-24">

        {/* ── Why this opportunity? ─────────────────────────── */}
        {whyMetrics.length > 0 && (
          <div>
            <button
              onClick={() => setWhyOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${whyOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Why this opportunity?
            </button>
            {whyOpen && (
              <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Supporting Data</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {whyMetrics.map((m) => (
                    <div key={m.slug} className="bg-white rounded-md px-2.5 py-1.5 border border-indigo-100">
                      <div className="text-xs text-gray-500 truncate">{m.name}</div>
                      <div className="text-sm font-bold text-gray-900">{formatMetricValue(m.value, m.unit)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Recommendation ───────────────────────────────── */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Recommendation</div>
          <div className="font-semibold text-gray-900 text-sm sm:text-base">{opp.recommendation}</div>
        </div>

        {/* ── Detail ───────────────────────────────────────── */}
        {opp.detail && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Detail</div>
            <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              {opp.detail}
            </div>
          </div>
        )}

        {/* ── Next Steps ───────────────────────────────────── */}
        {nextSteps.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Next Steps</div>
            <ol className="space-y-2">
              {nextSteps.map((step, i) => {
                const { role, text } = parseRole(step);
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-700">
                      {role && (
                        <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded mr-1.5 ${roleColor(role)}`}>
                          {role}
                        </span>
                      )}
                      {text}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* ── Alternatives ─────────────────────────────────── */}
        {alternatives.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Alternatives</div>
            <ul className="space-y-1">
              {alternatives.map((alt, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-gray-300 flex-shrink-0">→</span>
                  <span>{alt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function OppGroup({ type, opps }: { type: string; opps: Opportunity[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const totalValue = opps.reduce((s, o) => s + (o.valueSized || 0), 0);
  const visibleOpps = showMore ? opps : opps.slice(0, INITIAL_SHOW);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-b ${expanded ? 'border-gray-100' : 'border-transparent'} transition-colors hover:bg-gray-50 text-left`}
      >
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform text-gray-400 ${expanded ? 'rotate-0' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${oppTypeColor(type)}`} />
        <span className="font-semibold text-gray-900 text-sm sm:text-base flex-1">{type}</span>
        <span className="font-bold text-gray-900 text-sm sm:text-base">{formatDollar(totalValue)}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${oppTypeHeaderColor(type)}`}>
          {opps.length} {opps.length === 1 ? 'opportunity' : 'opportunities'}
        </span>
      </button>

      {/* Opportunities list */}
      {expanded && (
        <div className="divide-y divide-gray-50">
          {visibleOpps.map((opp) => (
            <OppCard key={opp.id} opp={opp} />
          ))}

          {/* Show more / show less */}
          {opps.length > INITIAL_SHOW && (
            <div className="px-4 sm:px-5 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-xs text-gray-400">
                {showMore ? `All ${opps.length} shown` : `${opps.length - INITIAL_SHOW} more hidden`}
              </span>
              <button
                onClick={() => setShowMore((v) => !v)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {showMore ? 'Show less ↑' : `Show all ${opps.length} →`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OpportunitiesSection({ opportunities }: { opportunities: Opportunity[] }) {
  // Group by type
  const grouped: Record<string, Opportunity[]> = {};
  for (const opp of opportunities) {
    if (!grouped[opp.type]) grouped[opp.type] = [];
    grouped[opp.type].push(opp);
  }

  // Sort types by predefined order, then alphabetically for unknown types
  const types = [
    ...TYPE_ORDER.filter((t) => grouped[t]),
    ...Object.keys(grouped).filter((t) => !TYPE_ORDER.includes(t)).sort(),
  ];

  return (
    <div className="space-y-2 sm:space-y-3">
      {types.map((type) => (
        <OppGroup key={type} type={type} opps={grouped[type]} />
      ))}
    </div>
  );
}
