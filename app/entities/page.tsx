import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EntitiesBrowser } from './EntitiesBrowser';

export const dynamic = 'force-dynamic';

function formatDollar(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const sp = await searchParams;
  const orgId = sp.orgId ? parseInt(sp.orgId) : 1;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) redirect('/setup');

  const entities = await prisma.entity.findMany({
    where: { orgId },
    include: {
      score: true,
      opportunities: {
        orderBy: { valueSized: 'desc' },
        take: 1,
        select: {
          id: true,
          title: true,
          type: true,
          valueSized: true,
        },
      },
    },
    orderBy: { canonicalName: 'asc' },
  });

  const totalValue = await prisma.opportunity.aggregate({
    where: { orgId },
    _sum: { valueSized: true },
  });

  const oppCount = await prisma.opportunity.count({ where: { orgId } });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="text-xl sm:text-2xl font-bold text-indigo-600 flex-shrink-0">Opps.</Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-gray-700 font-medium text-sm sm:text-base truncate">{org.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/dashboard?orgId=${orgId}`}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-medium rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              ← Dashboard
            </Link>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page title + summary */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Entity Browser</h1>
          <p className="text-gray-500 text-sm">
            {entities.length} entities · {oppCount} opportunities · {formatDollar(totalValue._sum.valueSized ?? 0)} total value
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{entities.length}</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Entities</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{oppCount}</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Opportunities</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{formatDollar(totalValue._sum.valueSized ?? 0)}</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-0.5">Total Value</div>
          </div>
        </div>

        {/* Entity browser */}
        <EntitiesBrowser entities={entities} orgId={orgId} />

      </main>
    </div>
  );
}
