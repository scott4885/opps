'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [orgId, setOrgId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    entitiesProcessed: number;
    metricsCreated: number;
    sheetsProcessed: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) { setError('Organization name is required'); return; }
    setError('');
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), industry: industry.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrgId(data.org.id);
      setStep(2);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!orgId) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('orgId', String(orgId));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadResult(data);
      setStep(3);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>{s}</div>
              {s < 4 && <div className={`w-8 h-0.5 ${step > s ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell us about your organization</h2>
              <p className="text-gray-500 mb-6">This helps our AI understand your business context.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                  <input
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="e.g. Acme Corporation"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <input
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="e.g. Healthcare, Retail, Manufacturing"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  onClick={handleCreateOrg}
                  className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Upload your first data file</h2>
              <p className="text-gray-500 mb-6">Excel or CSV — our AI will figure out the rest.</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="text-4xl mb-3">📁</div>
                {uploading ? (
                  <div className="text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                    <p>Processing with AI...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-700 font-medium">Drop your file here</p>
                    <p className="text-sm text-gray-400 mt-1">Excel (.xlsx, .xls) or CSV</p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
              </div>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              <button
                onClick={() => setStep(3)}
                className="mt-4 text-sm text-gray-400 hover:text-gray-600"
              >
                Skip for now →
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Looking good! 🎉</h2>
              {uploadResult && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-6">
                  <p className="text-green-700 font-medium">File processed successfully</p>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.entitiesProcessed}</div>
                      <div className="text-xs text-green-600">Entities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.metricsCreated}</div>
                      <div className="text-xs text-green-600">Metrics</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.sheetsProcessed}</div>
                      <div className="text-xs text-green-600">Sheets</div>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-gray-500 mb-6">
                Opportunities are being generated in the background. Head to your dashboard to see them.
              </p>
              <button
                onClick={() => orgId && router.push(`/dashboard?orgId=${orgId}`)}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View Opportunity Report →
              </button>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-400">
          <a href="/" className="hover:text-gray-600">← Back to home</a>
        </p>
      </div>
    </div>
  );
}
