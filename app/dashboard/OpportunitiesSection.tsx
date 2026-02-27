'use client';

import { useState } from 'react';
import { stripEntityPrefix } from './EntityTable';

interface Opportunity {
  id: number;
  title: string;
  type: string;
  priority: number;
  valueSized: number | null;
  recommendation: string;
  alternatives: string | null;
  entity: {
    id: number;
    canonicalName: string;
    score: { score: number } | null;
  } | null;
}

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
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

const TYPE_ORDER = ['Revenue', 'Efficiency', 'Capacity', 'Cost', 'Retention'];
const INITIAL_SHOW = 5;

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
          {visibleOpps.map((opp) => {
            let alternatives: string[] = [];
            try { alternatives = opp.alternatives ? JSON.parse(opp.alternatives) : []; } catch {}
            const entityName = opp.entity?.canonicalName || '';
            const cleanTitle = stripEntityPrefix(opp.title, entityName);

            return (
              <details key={opp.id} className="group hover:bg-gray-50 transition-colors">
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
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-3 sm:pt-4 space-y-3 ml-16 sm:ml-24">
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Recommendation</div>
                    <div className="font-semibold text-gray-900 text-sm sm:text-base">{opp.recommendation}</div>
                  </div>
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
          })}

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
