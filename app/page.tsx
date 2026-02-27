import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const orgs = await prisma.organization.findMany({ orderBy: { createdAt: 'asc' } });

  if (orgs.length === 1) {
    redirect(`/dashboard?orgId=${orgs[0].id}`);
  }

  if (orgs.length > 1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-600 mb-2">Opps.</h1>
            <p className="text-gray-600">Select your organization</p>
          </div>
          <div className="space-y-3">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/dashboard?orgId=${org.id}`}
                className="block w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="font-semibold text-gray-900">{org.name}</div>
                {org.industry && <div className="text-sm text-gray-500">{org.industry}</div>}
              </Link>
            ))}
          </div>
          <Link
            href="/setup"
            className="mt-6 block text-center text-sm text-indigo-600 hover:underline"
          >
            + Add another organization
          </Link>
        </div>
      </div>
    );
  }

  // No orgs — show welcome
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto px-8 py-16 text-center">
        <div className="mb-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700">
          Business Intelligence, Redefined
        </div>
        <h1 className="text-6xl font-bold text-indigo-600 mb-4">Opps.</h1>
        <p className="text-xl text-gray-600 mb-4">
          Upload any business data. Get ranked, dollar-valued opportunities with one clear action each.
        </p>
        <p className="text-gray-500 mb-10">
          No setup. No data mapping. AI figures it all out automatically.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/setup"
            className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Get Started →
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-left">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">📤</div>
            <div className="font-semibold text-gray-900 mb-1">Upload Anything</div>
            <div className="text-sm text-gray-500">Excel, CSV — any format, any structure. AI handles the rest.</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-semibold text-gray-900 mb-1">Auto-Detect</div>
            <div className="text-sm text-gray-500">Entities, metrics, and relationships found automatically.</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">💰</div>
            <div className="font-semibold text-gray-900 mb-1">Dollar-Valued Opps</div>
            <div className="text-sm text-gray-500">Every opportunity sized in dollars with one clear action.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
