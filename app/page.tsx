import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const orgs = await prisma.organization.findMany({ orderBy: { createdAt: 'asc' } });
  const primaryOrg = orgs[0] ?? null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-2xl font-bold text-indigo-600 tracking-tight">Opps.</span>
        {primaryOrg && (
          <Link
            href={`/dashboard?orgId=${primaryOrg.id}`}
            className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
          >
            {primaryOrg.name} →
          </Link>
        )}
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto w-full">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          AI-Powered Business Intelligence
        </div>

        {/* Logo / Headline */}
        <h1 className="text-8xl font-black text-indigo-600 tracking-tight mb-4 leading-none">
          Opps.
        </h1>
        <p className="text-2xl text-gray-500 font-light mb-3">
          Opportunities, not Operations.
        </p>
        <p className="text-gray-400 text-base max-w-xl mb-12">
          Upload any business data. AI maps it, finds the gaps, and hands you dollar-valued opportunities with one clear action each.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md">
          {primaryOrg ? (
            <Link
              href={`/dashboard?orgId=${primaryOrg.id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-base"
            >
              View Dashboard →
            </Link>
          ) : (
            <Link
              href="/setup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-base"
            >
              Get Started →
            </Link>
          )}
          <Link
            href={primaryOrg ? `/upload?orgId=${primaryOrg.id}` : '/upload'}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-indigo-600 font-semibold rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-base"
          >
            Upload Data →
          </Link>
        </div>

        {/* Org switcher for multiple orgs */}
        {orgs.length > 1 && (
          <div className="mt-8 w-full max-w-sm">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Switch organization</p>
            <div className="space-y-2">
              {orgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/dashboard?orgId=${org.id}`}
                  className="block w-full p-3 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="font-semibold text-gray-900 text-sm">{org.name}</div>
                  {org.industry && <div className="text-xs text-gray-400">{org.industry}</div>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Feature strip */}
      <footer className="border-t border-gray-100 bg-gray-50 px-6 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { emoji: '📤', title: 'Upload Anything', desc: 'Excel, CSV — any format. AI handles the rest.' },
            { emoji: '🤖', title: 'Auto-Detect', desc: 'Entities, metrics & relationships found automatically.' },
            { emoji: '💰', title: 'Dollar-Valued Opps', desc: 'Every gap sized in dollars. One clear action each.' },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{f.emoji}</span>
              <span className="font-semibold text-gray-800 text-sm">{f.title}</span>
              <span className="text-gray-400 text-xs">{f.desc}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
