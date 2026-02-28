import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SignOutButton } from './SignOutButton';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RefreshButton } from './RefreshButton';
import { EntityTable } from './EntityTable';
import { OpportunitiesSection } from './OpportunitiesSection';
import { OpportunityValueChart } from './OpportunityValueChart';
import { EntityScoreChart } from './EntityScoreChart';

export const dynamic = 'force-dynamic';

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
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

function entityAnchor(id: number): string {
  return `entity-${id}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  // FIX-6: If admin with no orgId param, show org picker
  if (session && session.role === 'admin' && !sp.orgId) {
    const allOrgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, industry: true },
    });

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <span className="text-2xl font-bold text-indigo-600">Opps.</span>
            <h2 className="text-lg font-semibold text-gray-900 mt-4">Select an organization to view:</h2>
          </div>
          <div className="space-y-3">
            {allOrgs.map((o) => (
              <a
                key={o.id}
                href={`/dashboard?orgId=${o.id}`}
                className="block w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-sm transition-all text-left"
              >
                <div className="font-semibold text-gray-900">{o.name}</div>
                {o.industry && <div className="text-sm text-gray-400 mt-0.5">{o.industry}</div>}
              </a>
            ))}
          </div>
          <div className="mt-6 text-center">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const orgId = sp.orgId ? parseInt(sp.orgId) : (session?.orgId ?? 1);

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

  // Auth enforcement: members can only see their own org
  if (session && session.role === 'member' && session.orgId && session.orgId !== orgId) {
    redirect(`/dashboard?orgId=${session.orgId}`);
  }

  const opportunities = await prisma.opportunity.findMany({
    where: { orgId },
    orderBy: [{ priority: "asc" }, { valueSized: "desc" }],
    include: { entity: { include: { score: true, metricValues: { where: { isLatest: true }, include: { metric: true } } } }, metrics: true },
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

  const lastUploadFromSources = org.dataSources
    .flatMap((ds) => ds.uploads)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]?.uploadedAt;

  // FIX-7: Fall back to most recent entity createdAt when no uploads exist
  const lastUploadDate = lastUploadFromSources ?? await prisma.entity.findFirst({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  }).then(e => e?.createdAt);

  const sourcesConnected = org.dataSources.length;

  // Chart data
  const oppsByCategory = Object.entries(
    opportunities.reduce((acc, o) => {
      acc[o.type] = (acc[o.type] || 0) + (o.valueSized || 0);
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, value]) => ({ type, value })).sort((a, b) => b.value - a.value);

  const entityScoreData = entityScores.slice(0, 12).map(e => ({
    name: e.canonicalName,
    score: Math.round(e.score!.score)
  }));

  const lastUpdatedLabel = lastUploadDate
    ? new Date(lastUploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

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
            <SignOutButton />
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
              <span>Last updated {lastUpdatedLabel}</span>
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
              {formatDollar(totalOpportunityValue)}
            </div>
            <div className="text-indigo-700 font-medium text-base sm:text-lg">in identified opportunities</div>
            <div className="text-indigo-500 text-xs sm:text-sm mt-1">
              {opportunities.length} prioritized, dollar-valued opportunities across {entities.length} entities
            </div>
          </div>
        )}

        {/* Summary Stats Bar */}
        {entities.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">{entities.length}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Entities</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">{opportunities.length}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Opportunities</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{formatDollar(totalOpportunityValue)}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Total Value</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{lastUpdatedLabel}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Last Updated</div>
            </div>
          </div>
        )}

        {/* Charts — Opportunity Value by Category + Entity Score Chart */}
        {oppsByCategory.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <OpportunityValueChart data={oppsByCategory} />
            <EntityScoreChart data={entityScoreData} />
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

        {/* Opportunity Score Row — top 20, scrollable, link to full entities page */}
        {entityScores.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Opportunity Scores</h2>
                <span className="group relative inline-flex items-center cursor-help">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors select-none border border-gray-200">i</span>
                  <span className="invisible group-hover:visible absolute left-0 bottom-full mb-2 z-50 w-80 pointer-events-none">
                    <span className="block bg-gray-900 text-white text-xs rounded-xl p-4 shadow-2xl text-left leading-relaxed">
                      <span className="block font-semibold text-white mb-2 text-sm">How Opportunity Scores Work</span>
                      <span className="block text-gray-300 mb-2">Each entity gets a score from 0-100 reflecting unrealized value available. Higher score = more opportunity to capture.</span>
                      <span className="block text-gray-200 font-medium mb-1">Claude scores across 5 dimensions:</span>
                      <span className="block text-gray-300 mb-px">Revenue -- production gaps, pricing upside</span>
                      <span className="block text-gray-300 mb-px">Efficiency -- cost ratios, workflow bottlenecks</span>
                      <span className="block text-gray-300 mb-px">Capacity -- utilization vs. available hours</span>
                      <span className="block text-gray-300 mb-px">Cost -- spend optimization potential</span>
                      <span className="block text-gray-300 mb-3">Retention -- patient / customer churn risk</span>
                      <span className="block text-xs text-gray-400 border-t border-gray-700 pt-2">Red 80+ | Orange 60-79 | Yellow 40-59 | Green &lt;40 (well-optimized)</span>
                    </span>
                  </span>
                </span>
              </div>
              <Link
                href={`/entities?orgId=${orgId}`}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                View all → 
              </Link>
            </div>
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
              {entityScores.length > 20 && (
                <Link
                  href={`/entities?orgId=${orgId}`}
                  className="flex-shrink-0 w-36 sm:w-44 p-3 sm:p-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer no-underline flex flex-col items-center justify-center gap-1"
                >
                  <div className="text-2xl sm:text-3xl font-bold text-indigo-400">+{entityScores.length - 20}</div>
                  <div className="text-xs text-indigo-500 font-medium text-center">more entities</div>
                  <div className="text-xs text-indigo-400 mt-1">View all →</div>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Opportunities Section — grouped by type */}
        {opportunities.length > 0 && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Opportunities</h2>
            <OpportunitiesSection opportunities={opportunities} />
          </section>
        )}

        {/* Entity Details Table — searchable, paginated */}
        {entities.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                Entity Details
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                  {entities.length}
                </span>
              </h2>
              <Link
                href={`/entities?orgId=${orgId}`}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Full browser →
              </Link>
            </div>
            <EntityTable entities={entities} />
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
