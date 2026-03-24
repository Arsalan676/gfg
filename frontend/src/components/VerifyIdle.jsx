import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const NAV = [
  { icon: 'dashboard',    label: 'Dashboard',  to: '/',        active: true },
  { icon: 'sensors',      label: 'Live Check', to: '/live' },
  { icon: 'history',      label: 'History',    to: '/history' },
  { icon: 'settings',     label: 'Settings',   to: '#' },
];

function Sidebar() {
  return (
    <aside style={{ background: '#080808', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      className="fixed left-0 top-0 h-screen w-60 z-50 flex flex-col py-7 px-3">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(62,207,142,0.15)', border: '1px solid rgba(62,207,142,0.3)' }}>
          <span className="material-symbols-outlined text-sm" style={{ color: '#3ecf8e', fontVariationSettings: "'FILL' 1" }}>verified</span>
        </div>
        <span className="font-headline font-bold text-white text-sm tracking-tight">FactGuard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ icon, label, to, active }) => (
          <Link key={label} to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={active
              ? { background: 'rgba(62,207,142,0.1)', color: '#3ecf8e' }
              : { color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; } }}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom CTA */}
      <div className="px-1 space-y-3">
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="pt-4">
          <p className="text-[10px] uppercase tracking-widest mb-3 px-3" style={{ color: 'rgba(255,255,255,0.25)' }}>Status</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(62,207,142,0.06)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3ecf8e' }} />
            <span className="text-xs font-medium" style={{ color: '#3ecf8e' }}>Systems Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function VerifyIdle() {
  const [content, setContent] = useState('');
  const navigate = useNavigate();
  const charCount = content.trim().length;
  const isReady = charCount >= 50;

  const handleBeginVerification = () => {
    if (isReady) {
      navigate('/live', { state: { content, inputType: content.startsWith('http') ? 'url' : 'text' } });
    }
  };

  return (
    <div className="min-h-screen font-body" style={{ background: '#050505', color: '#fff' }}>
      <Sidebar />

      {/* Header */}
      <header className="fixed top-0 right-0 left-60 h-14 z-40 flex items-center justify-between px-8"
        style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-white">Verify</span>
          <nav className="hidden lg:flex items-center gap-5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Link to="/" style={{ color: '#3ecf8e' }}>New Verification</Link>
            <Link to="/history" className="hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}>History</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3ecf8e' }} />
            Live
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ml-60 mt-14 flex flex-col min-h-[calc(100vh-3.5rem)]">
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-3xl mx-auto w-full">

          {/* Hero */}
          <div className="text-center mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-2"
              style={{ background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)' }}>
              <span className="material-symbols-outlined text-xs">verified_user</span>
              AI-Powered Fact Verification
            </div>
            <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight leading-[1.1]">
              Verify any claim,<br />
              <span style={{ color: '#3ecf8e' }}>instantly.</span>
            </h1>
            <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Paste an article, news piece, or any text. Our AI extracts claims, searches for evidence, and delivers a detailed truth analysis.
            </p>
          </div>

          {/* Input card */}
          <div className="w-full rounded-2xl overflow-hidden"
            style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ color: '#3ecf8e' }}>text_snippet</span>
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Input</span>
              </div>
              <button
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
                title="Paste from clipboard"
                onClick={() => navigator.clipboard.readText().then(t => setContent(t)).catch(() => {})}
              >
                <span className="material-symbols-outlined text-sm">content_paste</span>
                Paste
              </button>
            </div>

            {/* Textarea */}
            <textarea
              className="w-full bg-transparent border-none outline-none resize-none px-5 py-4 text-sm leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#3ecf8e', minHeight: '180px' }}
              placeholder="Paste article text or a URL here..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />

            {/* Card footer */}
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xs" style={{ color: isReady ? 'rgba(62,207,142,0.7)' : 'rgba(255,255,255,0.25)' }}>
                {charCount} chars {!isReady && charCount > 0 ? `— need ${50 - charCount} more` : isReady ? '— ready' : ''}
              </span>
              <button
                onClick={handleBeginVerification}
                disabled={!isReady}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={isReady
                  ? { background: '#3ecf8e', color: '#050505' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}
              >
                Verify
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Quick-start */}
          <div className="w-full mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Try an example
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: 'article',         title: 'News Article',  desc: 'Paste a full news article for deep fact-checking' },
                { icon: 'travel_explore',  title: 'URL / Link',    desc: 'Drop a link and we\'ll crawl it automatically' },
              ].map(({ icon, title, desc }) => (
                <button key={title}
                  className="flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                  style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(62,207,142,0.2)'; e.currentTarget.style.background = 'rgba(62,207,142,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = '#0f0f0f'; }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.15)' }}>
                    <span className="material-symbols-outlined text-base" style={{ color: '#3ecf8e' }}>{icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer stats */}
        <div className="ml-0 px-8 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-10">
            {[
              { value: 'Gemini 2.5', label: 'AI Model' },
              { value: 'Real-time', label: 'Evidence Search' },
              { value: '5 Stages', label: 'Pipeline' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-sm font-semibold text-white">{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
