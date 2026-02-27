'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { stripEntityPrefix } from '@/app/dashboard/EntityTable';

interface Opportunity {
  id: number;
  title: string;
  type: string;
  valueSized: number | null;
}

interface Entity {
  id: number;
  canonicalName: string;
  entityType: string | null;
  score: { score: number; primaryOpportunityType: string | null } | null;
  opportunities: Opportunity[];
}

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-red-600 bg-red-50 border-red-200';
  if (score >= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
  if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-green-600 bg-green-50 border-green-200';
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

type SortKey = 'score' | 'name' | 'value';

const PAGE_SIZE = 25;

export function EntitiesBrowser({ entities, orgId }: { entities: Entity[]; orgId: number }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('score');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = q ? entities.filter((e) => e.canonicalName.toLowerCase().includes(q)) : [...entities];

    result.sort((a, b) => {
      if (sort === 'score') {
        return (b.score?.score || 0) - (a.score?.score || 0);
      }
      if (sort === 'name') {
        return a.canonicalName.localeCompare(b.canonicalName);
      }
      if (sort === 'value') {
        const aVal = a.opportunities[0]?.valueSized || 0;
        const bVal = b.opportunities[0]?.valueSized || 0;
        return bVal - aVal;
      }
      return 0;
    });

    return result;
  }, [entities, search, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEntities = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handleSort(key: SortKey) {
    setSort(key);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search entities by name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder-gray-400"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 font-medium">Sort:</span>
          {(['score', 'name', 'value'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                sort === key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {key === 'score' ? 'Score' : key === 'name' ? 'Name' : 'Value'}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="text-sm text-gray-500">
        {search ? (
          <span>{filtered.length} of {entities.length} entities match &ldquo;{search}&rdquo;</span>
        ) : (
          <span>{entities.length} entities total</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No entities match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">
                      <button onClick={() => handleSort('name')} className={`hover:text-indigo-600 transition-colors ${sort === 'name' ? 'text-indigo-600' : ''}`}>
                        Entity ↕
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">Type</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500">
                      <button onClick={() => handleSort('score')} className={`hover:text-indigo-600 transition-colors ${sort === 'score' ? 'text-indigo-600' : ''}`}>
                        Score ↕
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">Top Opportunity</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-500">
                      <button onClick={() => handleSort('value')} className={`hover:text-indigo-600 transition-colors ${sort === 'value' ? 'text-indigo-600' : ''}`}>
                        Value ↕
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageEntities.map((entity, idx) => {
                    const topOpp = entity.opportunities[0];
                    const score = entity.score?.score;
                    const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
                    const cleanTitle = topOpp ? stripEntityPrefix(topOpp.title, entity.canonicalName) : '';

                    return (
                      <tr key={entity.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-300 text-xs font-mono">{globalIdx}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{entity.canonicalName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {entity.entityType || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {score != null ? (
                            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full border text-sm font-bold ${scoreColor(score)}`}>
                              {Math.round(score)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {topOpp ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${oppTypeColor(topOpp.type)}`} />
                              <span className="text-xs text-gray-700 truncate max-w-xs" title={cleanTitle}>
                                {cleanTitle}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-semibold text-gray-900">
                            {topOpp?.valueSized ? formatDollar(topOpp.valueSized) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {pageEntities.map((entity, idx) => {
              const topOpp = entity.opportunities[0];
              const score = entity.score?.score;
              const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
              const cleanTitle = topOpp ? stripEntityPrefix(topOpp.title, entity.canonicalName) : '';

              return (
                <div key={entity.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-300 font-mono mb-0.5">#{globalIdx}</div>
                      <div className="font-semibold text-gray-900 text-sm">{entity.canonicalName}</div>
                      {entity.entityType && (
                        <div className="text-xs text-gray-400 mt-0.5">{entity.entityType}</div>
                      )}
                    </div>
                    {score != null && (
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full border text-sm font-bold flex-shrink-0 ${scoreColor(score)}`}>
                        {Math.round(score)}
                      </span>
                    )}
                  </div>
                  {topOpp && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${oppTypeColor(topOpp.type)}`} />
                        <span className="text-xs text-gray-600 truncate">{cleanTitle}</span>
                      </div>
                      <span className="font-semibold text-gray-900 text-sm flex-shrink-0">
                        {topOpp.valueSized ? formatDollar(topOpp.valueSized) : '—'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="px-3 font-medium">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
