import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-2xl font-bold text-indigo-600 tracking-tight">Opps.</span>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
        >
          Login →
        </Link>
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

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-base"
          >
            Login →
          </Link>
        </div>
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
