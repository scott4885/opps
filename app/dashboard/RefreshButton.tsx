'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshButton({ orgId }: { orgId: number }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const router = useRouter();

  async function handleRefresh() {
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch(`/api/orgs/${orgId}/refresh`, { method: 'POST' });
      if (res.ok) {
        setStatus('ok');
        router.refresh();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className={`inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors border
        ${loading
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          : status === 'ok'
            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
            : status === 'error'
              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
        }`}
      title="Re-run opportunity engine across all entities"
    >
      {loading ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="hidden sm:inline">Running…</span>
        </>
      ) : status === 'ok' ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="hidden sm:inline">Done</span>
        </>
      ) : status === 'error' ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="hidden sm:inline">Error</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Refresh Opps</span>
        </>
      )}
    </button>
  );
}
