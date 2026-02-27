'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

interface UploadResult {
  ok: boolean;
  uploadId?: number;
  uploadIds?: number[];
  entitiesProcessed?: number;
  metricsCreated?: number;
  sheetsProcessed?: number;
  // crosswalk results
  isCrosswalk?: boolean;
  entitiesCreated?: number;
  aliasesMapped?: number;
  error?: string;
}

interface Props {
  orgId: number;
  orgName: string;
}

export default function UploadClient({ orgId, orgName }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [processingStep, setProcessingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setSelectedFile(file);
    setUploading(true);
    setResult(null);
    setError('');
    setProcessingStep(1);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('orgId', String(orgId));

    // Simulate step progression for UX
    const stepTimer = setInterval(() => {
      setProcessingStep((prev) => Math.min(prev + 1, 3));
    }, 4000);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      clearInterval(stepTimer);
      setUploading(false);
      setProcessingStep(0);
    }
  }, [orgId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const steps = [
    { label: 'Parsing file structure', done: processingStep > 1 },
    { label: 'AI mapping fields & detecting type', done: processingStep > 2 },
    { label: 'Processing entities & metrics', done: processingStep > 3 },
    { label: 'Running opportunity engine', done: false },
  ];

  const reset = () => { setResult(null); setSelectedFile(null); setError(''); };

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
            <Link
              href={`/dashboard?orgId=${orgId}`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Upload Business Data</h1>
          <p className="text-gray-500 text-sm sm:text-base">
            Upload any Excel or CSV file. AI will automatically map fields, identify entities, and surface opportunities.
            <br className="hidden sm:inline" />
            <span className="text-indigo-600 font-medium"> MasterLookup files</span> are automatically detected and processed as entity crosswalks.
          </p>
        </div>

        {/* Drop Zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center cursor-pointer transition-all
              ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'}
              ${uploading ? 'cursor-not-allowed opacity-80' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />

            {uploading ? (
              <div className="space-y-6">
                {/* Spinner */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <svg className="animate-spin w-14 h-14 text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 text-lg">Processing {selectedFile?.name}…</div>
                  <div className="text-gray-400 text-sm mt-1">AI is analyzing your file. This takes 5–30 seconds.</div>
                </div>
                {/* Step progress */}
                <div className="space-y-2 text-sm text-left max-w-xs mx-auto">
                  {steps.map((step, i) => (
                    <div key={i} className={`flex items-center gap-2 transition-opacity ${processingStep > i ? 'opacity-100' : 'opacity-40'}`}>
                      {step.done ? (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : processingStep === i + 1 ? (
                        <svg className="animate-spin w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" />
                      )}
                      <span className={processingStep > i ? 'text-gray-700' : 'text-gray-400'}>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-5xl">📤</div>
                <div>
                  <div className="font-semibold text-gray-800 text-lg">
                    {dragOver ? 'Drop it!' : 'Drag & drop your file here'}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">or click to browse · Excel (.xlsx, .xls) or CSV</div>
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
            <div className="font-semibold text-red-700 mb-1">Upload failed</div>
            <div className="text-red-600 text-sm">{error}</div>
            <button onClick={reset} className="mt-3 text-sm text-red-600 underline hover:no-underline">
              Try again
            </button>
          </div>
        )}

        {/* Success — Crosswalk */}
        {result?.ok && result?.isCrosswalk && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg">🔗</div>
                <div>
                  <div className="font-bold text-blue-900 text-lg">Crosswalk processed!</div>
                  <div className="text-blue-600 text-sm">{selectedFile?.name} — MasterLookup detected</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 text-center border border-blue-100">
                  <div className="text-3xl font-bold text-blue-700">{result.entitiesCreated ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">Entities Created</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-blue-100">
                  <div className="text-3xl font-bold text-blue-700">{result.aliasesMapped ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">Aliases Mapped</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/dashboard?orgId=${orgId}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-center"
              >
                View Dashboard →
              </Link>
              <button
                onClick={reset}
                className="px-6 py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}

        {/* Success — Regular */}
        {result?.ok && !result?.isCrosswalk && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-green-800 text-lg">Upload complete!</div>
                  <div className="text-green-600 text-sm">{selectedFile?.name} · {orgName}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 text-center border border-green-100">
                  <div className="text-3xl font-bold text-green-700">{result.entitiesProcessed ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">New Entities</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-green-100">
                  <div className="text-3xl font-bold text-green-700">{result.metricsCreated ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">Metrics Created</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-green-100">
                  <div className="text-3xl font-bold text-indigo-600">{result.sheetsProcessed ?? result.uploadIds?.length ?? 1}</div>
                  <div className="text-sm text-gray-500 mt-1">Sheets Processed</div>
                </div>
              </div>
              <p className="text-green-700 text-xs mt-4 text-center">
                Opportunity engine is running in the background — check the dashboard in ~30 seconds.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/dashboard?orgId=${orgId}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-center"
              >
                View Dashboard →
              </Link>
              <button
                onClick={reset}
                className="px-6 py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}

        {/* Format hints */}
        {!uploading && !result && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { emoji: '📊', label: 'Excel Workbooks', desc: 'Multi-sheet .xlsx files, any layout' },
              { emoji: '📋', label: 'CSV Files', desc: 'Any delimiter, any column structure' },
              { emoji: '🔗', label: 'MasterLookup / Crosswalk', desc: 'Auto-detected — creates entity aliases from canonical names' },
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
