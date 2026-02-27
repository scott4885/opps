'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

interface UploadResult {
  ok: boolean;
  uploadIds?: number[];
  entitiesProcessed?: number;
  metricsCreated?: number;
  sheetsProcessed?: number;
  error?: string;
}

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setSelectedFile(file);
    setUploading(true);
    setResult(null);
    setError('');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('orgId', '1');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-2xl font-bold text-indigo-600">Opps.</Link>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium">Upload Data</span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Business Data</h1>
          <p className="text-gray-500">
            Upload any Excel or CSV file. AI will automatically map fields, identify entities, and surface opportunities.
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
              border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
              ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'}
              ${uploading ? 'cursor-not-allowed opacity-60' : ''}
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
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <svg className="animate-spin w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 text-lg">Processing {selectedFile?.name}…</div>
                  <div className="text-gray-500 text-sm mt-1">AI is mapping fields and identifying opportunities. This may take 30-60 seconds.</div>
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <div>✓ Parsing file structure</div>
                  <div>⟳ Mapping fields with AI</div>
                  <div>⟳ Processing entities &amp; metrics</div>
                  <div>⟳ Running opportunity engine</div>
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
            <button
              onClick={() => { setError(''); setResult(null); setSelectedFile(null); }}
              className="mt-3 text-sm text-red-600 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Success Result */}
        {result?.ok && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-green-800 text-lg">Upload complete!</div>
                  <div className="text-green-600 text-sm">{selectedFile?.name}</div>
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
                  <div className="text-3xl font-bold text-indigo-600">{result.sheetsProcessed ?? result.uploadIds?.length ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">Sheets Processed</div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-center"
              >
                View Dashboard →
              </Link>
              <button
                onClick={() => { setResult(null); setSelectedFile(null); setError(''); }}
                className="px-6 py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}

        {/* Format hints */}
        {!uploading && !result && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { emoji: '📊', label: 'Excel Workbooks', desc: 'Multi-sheet .xlsx files, any layout' },
              { emoji: '📋', label: 'CSV Files', desc: 'Any delimiter, any column structure' },
              { emoji: '🔍', label: 'Auto-Detection', desc: 'AI maps headers, entities & metrics automatically' },
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
