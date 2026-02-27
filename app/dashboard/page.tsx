import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RefreshButton } from './RefreshButton';

export const dynamic = 'force-dynamic';

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-red-600';
  if (score >= 60) return 'text-orange-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-green-600';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-red-50 border-red-200 hover:border-red-400';
  if (score >= 60) return 'bg-orange-50 border-orange-200 hover:border-orange-400';
  if (score >= 40) return 'bg-yellow-50 border-yellow-200 hover:border-yellow-400';
  return 'bg-green-50 border-green-200 hover:border-green-400';
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

/** Stable anchor id for an entity row */
function entityAnchor(id: number): string {
  return `entity-${id}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const sp = await searchParams;
  const orgId = sp.orgId ? parseInt(sp.orgId) : 1;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      dataSources: {
        include: {
          uploads: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!org) redirect('/setup');

  const opportunities = await prisma.opportunity.findMany({
    where: { orgId },
    include: { entity: { include: { score: true } } },
    orderBy: [{ priority: 'asc' }, { valueSized: 'desc' }],
  });

  const entities = await prisma.entity.findMany({
    where: { orgId },
    include: {
      score: true,
      metricValues: {
        where: { isLatest: true },
        include: { metric: true },
        take: 3,
      },
      opportunities: { orderBy: { valueSized: 'desc' }, take: 1 },
    },
    orderBy: { canonicalName: 'asc' },
  });

  const totalOpportunityValue = opportunities.reduce(
    (sum, o) => sum + (o.valueSized || 0),
    0
  );

  const entityScores = entities
    .filter((e) => e.score !== null)
    .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0));

  const lastUploadDate = org.dataSources
    .flatMap((ds) => ds.uploads)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]?.uploadedAt;

  const sourcesConnected = org.dataSources.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="text-xl sm:text-2xl font-bold text-indigo-600 flex-shrink-0">Opps.</Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-gray-700 font-medium text-sm sm:text-base truncate">{org.name}</span>
            {org.industry && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full hidden md:inline">
                {org.industry}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastUploadDate && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                Refreshed {new Date(lastUploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            <RefreshButton orgId={orgId} />
            <Link
              href={`/upload?orgId=${orgId}`}
              className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="hidden sm:inline">Upload File</span>
              <span className="sm:hidden">Upload</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Sub-header stats strip */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
          <span>{sourcesConnected} source{sourcesConnected !== 1 ? 's' : ''}</span>
          {lastUploadDate && (
            <>
              <span className="text-gray-300">·</span>
              <span>Last updated {new Date(lastUploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span>{entities.length} entities</span>
          <span className="text-gray-300">·</span>
          <span>{opportunities.length} opportunities</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* Total Opportunity Band */}
        {totalOpportunityValue > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 sm:p-8 text-center">
            <div className="text-4xl sm:text-5xl font-bold text-indigo-600 mb-2">
              {totalOpportunityValue >= 1_000_000
                ? `$${(totalOpportunityValue / 1_000_000).toFixed(2)}M`
                : `$${Math.round(totalOpportunityValue).toLocaleString()}`}
            </div>
            <div className="text-indigo-700 font-medium text-base sm:text-lg">in identified opportunities</div>
            <div className="text-indigo-500 text-xs sm:text-sm mt-1">
              {opportunities.length} prioritized, dollar-valued opportunities across {entities.length} entities
            </div>
          </div>
        )}

        {opportunities.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 sm:p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No data yet</h2>
            <p className="text-gray-500 mb-6 text-sm">Upload your first business data file to surface opportunities.</p>
            <Link href={`/upload?orgId=${orgId}`} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
              Upload a File →
            </Link>
          </div>
        )}

        {/* Opportunity Score Row — cards are clickable and scroll to entity */}
        {entityScores.length > 0 && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Opportunity Scores</h2>
            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {entityScores.slice(0, 20).map((entity) => {
                const score = entity.score!;
                return (
                  <a
                    key={entity.id}
                    href={`#${entityAnchor(entity.id)}`}
                    className={`flex-shrink-0 w-36 sm:w-44 p-3 sm:p-4 rounded-xl border transition-all cursor-pointer no-underline ${scoreBg(score.score)}`}
                  >
                    <div className="text-xs font-medium text-gray-500 mb-1 truncate" title={entity.canonicalName}>
                      {entity.canonicalName}
                    </div>
                    <div className={`text-2xl sm:text-3xl font-bold mb-1 ${scoreColor(score.score)}`}>
                      {Math.round(score.score)}
                    </div>
                    {score.primaryOpportunityType && (
                      <div className="text-xs text-gray-600 truncate">{score.primaryOpportunityType}</div>
                    )}
                    {score.primaryValueSized && (
                      <div className="text-xs font-semibold text-gray-800 mt-0.5">
                        {formatDollar(score.primaryValueSized)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1 opacity-70">↓ scroll to</div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Opportunities Section */}
        {opportunities.length > 0 && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Opportunities</h2>
            <div className="space-y-2 sm:space-y-3">
              {opportunities.map((opp) => {
                let alternatives: string[] = [];
                try { alternatives = opp.alternatives ? JSON.parse(opp.alternatives) : []; } catch {}
                return (
                  <details key={opp.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors group">
                    <summary className="flex items-center gap-2 sm:gap-4 p-3 sm:p-5 cursor-pointer list-none">
                      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${oppTypeColor(opp.type)}`} />
                      <div className="flex-shrink-0 w-16 sm:w-24 text-right">
                        <span className="text-base sm:text-xl font-bold text-gray-900">{formatDollar(opp.valueSized)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">{opp.title}</div>
                        {opp.entity && (
                          <div className="text-xs sm:text-sm text-gray-500">{opp.entity.canonicalName}</div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white hidden sm:inline ${oppTypeColor(opp.type)}`}>
                          {opp.type}
                        </span>
                        <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-3 sm:pt-4 space-y-3">
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
            </div>
          </section>
        )}

        {/* Entity Details Table — with anchor IDs for score card links */}
        {entities.length > 0 && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              Entity Details
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                {entities.length}
              </span>
            </h2>

            {/* Desktop table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 font-semibold text-gray-500">Entity</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Score</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500">Top Opportunity</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-500">Value</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-500">Key Metrics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entities.map((entity) => {
                      const topOpp = entity.opportunities[0];
                      const score = entity.score?.score;
                      return (
                        <tr
                          key={entity.id}
                          id={entityAnchor(entity.id)}
                          className="hover:bg-gray-50 transition-colors scroll-mt-20"
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-900">{entity.canonicalName}</div>
                            <div className="text-xs text-gray-400">{entity.entityType}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {score != null ? (
                              <span className={`text-lg font-bold ${scoreColor(score)}`}>
                                {Math.round(score)}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {topOpp ? (
                              <div>
                                <div className="font-medium text-gray-800 text-xs">{topOpp.title}</div>
                                <span className={`text-xs text-white px-1.5 py-0.5 rounded ${oppTypeColor(topOpp.type)}`}>
                                  {topOpp.type}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">No opportunities</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-gray-900">
                              {topOpp?.valueSized ? formatDollar(topOpp.valueSized) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {entity.metricValues.slice(0, 3).map((mv) => (
                                <span key={mv.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {mv.metric.name}: {mv.metric.unit === 'dollar' ? formatDollar(mv.value) :
                                    mv.metric.unit === 'percent' ? `${(mv.value * 100).toFixed(1)}%` :
                                    mv.value.toFixed(1)}
                                </span>
                              ))}
                            </div>
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
              {entities.map((entity) => {
                const topOpp = entity.opportunities[0];
                const score = entity.score?.score;
                return (
                  <div
                    key={entity.id}
                    id={entityAnchor(entity.id)}
                    className="bg-white rounded-xl border border-gray-200 p-4 scroll-mt-16"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{entity.canonicalName}</div>
                        <div className="text-xs text-gray-400">{entity.entityType}</div>
                      </div>
                      {score != null && (
                        <span className={`text-xl font-bold flex-shrink-0 ${scoreColor(score)}`}>
                          {Math.round(score)}
                        </span>
                      )}
                    </div>
                    {topOpp && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <div className="text-xs text-gray-600 flex-1 min-w-0 mr-2 truncate">{topOpp.title}</div>
                        <span className="font-semibold text-gray-900 text-sm flex-shrink-0">
                          {topOpp.valueSized ? formatDollar(topOpp.valueSized) : '—'}
                        </span>
                      </div>
                    )}
                    {entity.metricValues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entity.metricValues.slice(0, 2).map((mv) => (
                          <span key={mv.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {mv.metric.name}: {mv.metric.unit === 'dollar' ? formatDollar(mv.value) :
                              mv.metric.unit === 'percent' ? `${(mv.value * 100).toFixed(1)}%` :
                              mv.value.toFixed(1)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Data Sources */}
        {org.dataSources.length > 0 && (
          <section>
            <details className="bg-white rounded-xl border border-gray-200">
              <summary className="px-4 sm:px-5 py-3 sm:py-4 cursor-pointer list-none flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Data Sources ({org.dataSources.length})</h2>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-3 sm:pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-2 font-semibold text-gray-500">Source</th>
                        <th className="pb-2 font-semibold text-gray-500">Last Upload</th>
                        <th className="pb-2 font-semibold text-gray-500 text-right">Rows</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {org.dataSources.map((ds) => {
                        const lastUpload = ds.uploads[0];
                        return (
                          <tr key={ds.id}>
                            <td className="py-2 font-medium text-gray-800">{ds.name}</td>
                            <td className="py-2 text-gray-500">
                              {lastUpload
                                ? new Date(lastUpload.uploadedAt).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="py-2 text-right text-gray-500">
                              {lastUpload?.rowCount?.toLocaleString() || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </section>
        )}

      </main>
    </div>
  );
}
