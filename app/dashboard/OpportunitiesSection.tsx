'use client';

import { useState, useEffect, useRef } from 'react';
import { stripEntityPrefix } from './EntityTable';

interface MetricValue {
  metric: {
    name: string;
    slug: string;
    category: string | null;
    unit: string | null;
  };
  value: number;
}

interface OpportunityMetric {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  unit: string | null;
}

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
    metricValues?: MetricValue[];
  } | null;
  metrics?: OpportunityMetric[];
}

interface AIDetail {
  why: string;
  numbers: Array<{ label: string; value: string; note?: string }>;
  calcBasis: string;
}

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatMetricValue(value: number, unit: string | null | undefined): string {
  if (!unit) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (unit === 'dollar') return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'days') return `${value.toFixed(1)} days`;
  if (unit === 'count') return Math.round(value).toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
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

// ─────────────────────────────────────────────────────────────
// DrillDownSection — "Why this opportunity?" expandable panel
// ─────────────────────────────────────────────────────────────
function DrillDownSection({ opp }: { opp: Opportunity }) {
  const linkedSlugs = new Set((opp.metrics || []).map((m) => m.slug));
  const allMetrics = opp.entity?.metricValues || [];

  // Prefer linked metrics, then fall back to all entity metrics
  const linkedMetrics = allMetrics.filter((mv) => linkedSlugs.has(mv.metric.slug));
  const otherMetrics = allMetrics.filter((mv) => !linkedSlugs.has(mv.metric.slug));
  const displayMetrics = linkedMetrics.length > 0 ? linkedMetrics : allMetrics.slice(0, 6);
  const hasMore = linkedMetrics.length > 0 && otherMetrics.length > 0;

  const [showAll, setShowAll] = useState(false);
  const finalMetrics = showAll ? allMetrics : displayMetrics;

  if (finalMetrics.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.346.394A5 5 0 0112 17H9.663" />
        </svg>
        <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Why this opportunity?</span>
        {linkedMetrics.length > 0 && (
          <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
            {linkedMetrics.length} triggering metric{linkedMetrics.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {finalMetrics.map((mv, i) => (
          <div
            key={i}
            className={`bg-white rounded-lg border p-2.5 ${
              linkedSlugs.has(mv.metric.slug)
                ? 'border-amber-200 shadow-sm'
                : 'border-gray-100 opacity-75'
            }`}
          >
            <div className="text-xs text-gray-500 mb-0.5 leading-tight">{mv.metric.name}</div>
            <div className={`text-base font-bold ${linkedSlugs.has(mv.metric.slug) ? 'text-gray-900' : 'text-gray-600'}`}>
              {formatMetricValue(mv.value, mv.metric.unit)}
            </div>
            {mv.metric.category && (
              <div className="text-xs text-gray-400 mt-0.5 capitalize">{mv.metric.category}</div>
            )}
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors"
        >
          {showAll ? 'Show fewer metrics ↑' : `+ ${otherMetrics.length} more entity metrics`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AIDetailSection — Detail + Next Steps loaded from API
// ─────────────────────────────────────────────────────────────
function AIDetailSection({ oppId }: { oppId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AIDetail | null>(null);
  const [nextSteps, setNextSteps] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/opportunity/${oppId}/detail`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) { setError(data.error); return; }
        if (data.aiDetail) setDetail(JSON.parse(data.aiDetail));
        if (data.aiNextSteps) setNextSteps(JSON.parse(data.aiNextSteps));
      })
      .catch(() => { if (!cancelled) setError('Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [oppId]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="text-xs text-gray-400 italic">Detail unavailable — {error || 'no data'}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Detail section ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 sm:p-4 space-y-3">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Detail
        </div>

        {/* Why */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why</div>
          <p className="text-sm text-gray-700 leading-relaxed">{detail.why}</p>
        </div>

        {/* The Numbers */}
        {detail.numbers && detail.numbers.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">The Numbers</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {detail.numbers.map((n, i) => (
                <div key={i} className="bg-white rounded-lg border border-blue-100 p-2.5">
                  <div className="text-xs text-gray-500 mb-0.5 leading-tight">{n.label}</div>
                  <div className="text-sm font-bold text-gray-900">{n.value}</div>
                  {n.note && <div className="text-xs text-gray-400 mt-0.5">{n.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calculation basis */}
        {detail.calcBasis && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Calculation Basis</div>
            <p className="text-xs text-gray-600 leading-relaxed italic">{detail.calcBasis}</p>
          </div>
        )}
      </div>

      {/* ── Next Steps section ── */}
      {nextSteps && nextSteps.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 sm:p-4">
          <div className="text-xs font-semibold text-green-800 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Next Steps
          </div>
          <ol className="space-y-2">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OppCard — single expanded opportunity with all sections
// ─────────────────────────────────────────────────────────────
function OppCard({ opp }: { opp: Opportunity }) {
  const [open, setOpen] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);

  let alternatives: string[] = [];
  try { alternatives = opp.alternatives ? JSON.parse(opp.alternatives) : []; } catch {}
  const entityName = opp.entity?.canonicalName || '';
  const cleanTitle = stripEntityPrefix(opp.title, entityName);

  const hasMetrics = (opp.entity?.metricValues?.length || 0) > 0;

  return (
    <div className="hover:bg-gray-50 transition-colors">
      {/* Summary row */}
      <button
        onClick={() => { setOpen((v) => !v); if (!open) setAiLoaded(true); }}
        className="w-full flex items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 cursor-pointer text-left"
      >
        <div className="flex-shrink-0 w-16 sm:w-24 text-right">
          <span className="text-base sm:text-xl font-bold text-gray-900">{formatDollar(opp.valueSized)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">{cleanTitle}</div>
          {opp.entity && (
            <div className="text-xs sm:text-sm text-gray-500">{entityName}</div>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-3 sm:pt-4 space-y-4 ml-16 sm:ml-24">

          {/* 1. Why this opportunity? — drill-down */}
          {hasMetrics && <DrillDownSection opp={opp} />}

          {/* 2. Recommendation */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Recommendation</div>
            <div className="font-semibold text-gray-900 text-sm sm:text-base">{opp.recommendation}</div>
          </div>

          {/* 3. AI Detail + Next Steps (fetched from API) */}
          {aiLoaded && <AIDetailSection oppId={opp.id} />}

          {/* 4. Alternatives */}
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
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OppGroup — collapsible group by opportunity type
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// OpportunitiesSection — main export
// ─────────────────────────────────────────────────────────────
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
