'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';

interface FileResult {
  filename: string;
  entities: number;
  metrics: number;
  sheets: number;
  isCrosswalk?: boolean;
  entitiesCreated?: number;
  aliasesMapped?: number;
}

export default function UploadClient({ orgId: initialOrgId, orgName }: { orgId: number; orgName: string }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<FileResult[]>([]);
  const [currentFile, setCurrentFile] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=ready, 2=uploading, 3=done
  const [orgId, setOrgId] = useState(initialOrgId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch orgId from session on mount
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.orgId) setOrgId(data.orgId);
    }).catch(() => {});
  }, []);

  const handleFileUpload = useCallback(async (files: File[]) => {
    setUploading(true);
    setError('');
    setStep(2);
    const results: FileResult[] = [];

    for (const file of files) {
      setCurrentFile(file.name);
      const fd = new FormData();
      fd.append('file', file);
      // orgId now read from session server-side, but pass for admin override
      if (orgId) fd.append('orgId', String(orgId));

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        results.push({
          filename: file.name,
          entities: data.entitiesProcessed ?? data.entitiesCreated ?? 0,
          metrics: data.metricsCreated ?? 0,
          sheets: data.sheetsProcessed ?? 0,
          isCrosswalk: data.isCrosswalk,
          entitiesCreated: data.entitiesCreated,
          aliasesMapped: data.aliasesMapped,
        });
      } catch (err) {
        setError(prev => prev ? prev + '\n' + `${file.name}: ${String(err)}` : `${file.name}: ${String(err)}`);
      }
      // Update results progressively so UI shows progress
      setUploadResults([...results]);
    }

    setUploadResults(results);
    setUploading(false);
    setCurrentFile('');
    if (results.length) setStep(3);
  }, [orgId]);

  const reset = () => {
    setUploadResults([]);
    setError('');
    setStep(1);
    setCurrentFile('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl font-bold text-indigo-600">Opps.</Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-gray-600 font-medium hidden sm:inline">Upload Data</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{orgName}</span>
            <Link href={`/dashboard?orgId=${orgId}`} className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Upload Business Data</h1>
          <p className="text-gray-500 text-sm sm:text-base">
            Upload any Excel or CSV files. AI will automatically map fields, identify entities, and surface opportunities.
            <br className="hidden sm:inline" />
            <span className="text-indigo-600 font-medium"> MasterLookup files</span> are automatically detected and processed as entity crosswalks.
          </p>
        </div>

        {/* Drop Zone — Step 1 & 2 */}
        {step !== 3 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length) handleFileUpload(files);
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center cursor-pointer transition-all
              ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'}
              ${uploading ? 'cursor-not-allowed opacity-80' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) handleFileUpload(files);
              }}
            />

            {uploading ? (
              <div>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-700 font-semibold text-lg">Processing {currentFile || 'files'}…</p>
                <p className="text-gray-400 text-sm mt-1">AI is analyzing your files. This may take a moment.</p>
                {uploadResults.length > 0 && (
                  <p className="text-green-600 text-xs mt-3">✓ {uploadResults.length} file{uploadResults.length > 1 ? 's' : ''} done</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-5xl">📤</div>
                <div>
                  <div className="font-semibold text-gray-800 text-lg">
                    {dragOver ? 'Drop them!' : 'Drop files here (or select multiple)'}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">Excel (.xlsx, .xls) or CSV — select multiple files at once</div>
                </div>
                <div className="text-xs text-gray-400">
                  Any structure works — AI figures it all out automatically
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="font-semibold text-red-700 mb-1">Upload error</div>
            <div className="text-red-600 text-sm whitespace-pre-line">{error}</div>
            <button onClick={reset} className="mt-3 text-sm text-red-600 underline hover:no-underline">Try again</button>
          </div>
        )}

        {/* Step 3 — Results */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-green-800 text-lg">
                    {uploadResults.length === 1 ? 'Upload complete!' : `${uploadResults.length} files processed!`}
                  </div>
                  <div className="text-green-600 text-sm">{orgName}</div>
                </div>
              </div>

              {/* Per-file results */}
              {uploadResults.map(r => (
                <div key={r.filename} className="bg-white border border-green-100 rounded-lg p-3 mb-2">
                  <p className="text-green-700 font-medium text-sm truncate">{r.filename}</p>
                  {r.isCrosswalk ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="text-center"><div className="text-lg font-bold text-blue-600">{r.entitiesCreated ?? 0}</div><div className="text-xs text-blue-600">Entities Created</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-blue-600">{r.aliasesMapped ?? 0}</div><div className="text-xs text-blue-600">Aliases Mapped</div></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="text-center"><div className="text-lg font-bold text-green-600">{r.entities}</div><div className="text-xs text-green-600">Entities</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-green-600">{r.metrics}</div><div className="text-xs text-green-600">Metrics</div></div>
                      <div className="text-center"><div className="text-lg font-bold text-green-600">{r.sheets}</div><div className="text-xs text-green-600">Sheets</div></div>
                    </div>
                  )}
                </div>
              ))}

              <p className="text-green-700 text-xs mt-4 text-center">
                Opportunity engine is running in the background — check the dashboard in ~30 seconds.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/dashboard?orgId=${orgId}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-center"
              >
                View Opportunity Report →
              </Link>
              <button
                onClick={reset}
                className="px-6 py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Upload More Files
              </button>
            </div>
          </div>
        )}

        {/* Format hints */}
        {step === 1 && !uploading && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { emoji: '📊', label: 'Excel Workbooks', desc: 'Multi-sheet .xlsx files, any layout' },
              { emoji: '📋', label: 'CSV Files', desc: 'Any delimiter, any column structure' },
              { emoji: '🔗', label: 'MasterLookup / Crosswalk', desc: 'Auto-detected — creates entity aliases' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <div className="text-2xl mb-2">{item.emoji}</div>
                <div className="font-semibold text-gray-800 text-sm mb-1">{item.label}</div>
                <div className="text-xs text-gray-400">{item.desc}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
