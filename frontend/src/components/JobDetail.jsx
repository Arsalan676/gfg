import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const API_BASE = 'http://localhost:8000';

const VERDICT_CONFIG = {
  true:           { label: 'TRUE',    text: '#3ecf8e', bg: 'rgba(62,207,142,0.08)',  border: 'rgba(62,207,142,0.2)',  dot: '#3ecf8e' },
  false:          { label: 'FALSE',   text: '#ff4444', bg: 'rgba(255,68,68,0.08)',   border: 'rgba(255,68,68,0.2)',   dot: '#ff4444' },
  partially_true: { label: 'PARTIAL', text: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)', dot: '#f59e0b' },
  unverifiable:   { label: 'UNVERIF',text: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', dot: '#555' },
};

const NAV = [
  { icon: 'dashboard',     label: 'Dashboard',  to: '/' },
  { icon: 'sensors',       label: 'Live Check', to: '/live' },
  { icon: 'history',       label: 'History',    to: '/history' },
  { icon: 'settings',      label: 'Settings',   to: '#' },
];

function Sidebar({ onNewAnalysis }) {
  return (
    <aside style={{ background: '#080808', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      className="fixed left-0 top-0 h-screen w-60 z-50 flex flex-col py-7 px-3">
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(62,207,142,0.15)', border: '1px solid rgba(62,207,142,0.3)' }}>
          <span className="material-symbols-outlined text-sm" style={{ color: '#3ecf8e', fontVariationSettings: "'FILL' 1" }}>verified</span>
        </div>
        <span className="font-headline font-bold text-white text-sm tracking-tight">FactGuard</span>
      </div>
      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ icon, label, to }) => (
          <Link key={label} to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-1">
        <button onClick={onNewAnalysis}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'rgba(62,207,142,0.12)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)' }}>
          New Verification
        </button>
      </div>
    </aside>
  );
}

function StatCard({ count, label, color }) {
  return (
    <div className="p-5 rounded-xl"
      style={{ background: '#0f0f0f', border: `1px solid rgba(255,255,255,0.07)`, borderTop: `2px solid ${color}` }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
      <span className="text-3xl font-headline font-bold text-white">{count}</span>
    </div>
  );
}

function ClaimCard({ claim, index }) {
  const v = VERDICT_CONFIG[claim.verdict] || VERDICT_CONFIG.unverifiable;
  const pct = Math.round(claim.confidence_score * 100);
  const r = 15;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="p-6 rounded-xl transition-all"
      style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = v.border; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-[10px] font-black tracking-[0.15em] uppercase rounded-lg"
              style={{ background: v.bg, color: v.text, border: `1px solid ${v.border}` }}>
              {v.label}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Claim #{String(index + 1).padStart(3, '0')}
            </span>
          </div>
          <h4 className="text-base font-headline font-semibold leading-snug text-white">"{claim.claim_text}"</h4>
          {claim.reasoning && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#3ecf8e' }}>Reasoning</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{claim.reasoning}</p>
            </div>
          )}
          {claim.sources && claim.sources.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Sources</p>
              <div className="flex flex-wrap gap-3">
                {claim.sources.slice(0, 3).map((src, i) => (
                  <a key={i} href={src.url || '#'} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs hover:underline transition-colors"
                    style={{ color: '#3ecf8e' }}>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                    {src.title || src.source || (src.url || '').replace(/^https?:\/\//, '').slice(0, 35) || 'Source'}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confidence ring */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-2">
          <div className="relative w-20 h-20">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="none" r={r} strokeWidth="2"
                style={{ stroke: 'rgba(255,255,255,0.07)' }} />
              <circle cx="18" cy="18" fill="none" r={r} strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ stroke: v.dot }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-headline font-black text-white">{pct}%</span>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: v.text }}>{v.label}</span>
        </div>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { job_id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!job_id) return;
    fetch(`${API_BASE}/api/jobs/${job_id}/`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setJob(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [job_id]);

  const report = job?.report;
  const claims = job?.claims || [];
  const aiProb = report?.ai_text_probability;
  const aiPct = aiProb != null ? Math.round(aiProb * 100) : null;
  const humanPct = aiPct != null ? 100 - aiPct : null;
  const overallPct = report ? Math.round(report.overall_score * 100) : 0;
  const verdictLabel = overallPct >= 80 ? 'Mostly True' : overallPct >= 60 ? 'Mixed' : overallPct >= 40 ? 'Questionable' : 'Mostly False';
  const verdictColor = overallPct >= 80 ? '#3ecf8e' : overallPct >= 60 ? '#f59e0b' : '#ff4444';

  const filteredClaims = claims.filter(c =>
    !searchQuery || c.claim_text.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const allSources = claims.flatMap(c => c.sources || []);
  const uniqueSources = Array.from(new Map(allSources.map(s => [s.source || s.url, s])).values()).slice(0, 4);

  return (
    <div className="min-h-screen font-body" style={{ background: '#050505', color: '#fff' }}>
      <Sidebar onNewAnalysis={() => navigate('/')} />

      {/* Header */}
      <header className="fixed top-0 right-0 left-60 h-14 z-40 flex items-center justify-between px-8"
        style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-white">Analysis Report</span>
          {job_id && (
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              {String(job_id).slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center px-3 py-1.5 rounded-lg min-w-[220px]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="material-symbols-outlined text-sm mr-2" style={{ color: 'rgba(255,255,255,0.3)' }}>search</span>
            <input className="bg-transparent border-none text-xs outline-none placeholder:text-white/30 w-full text-white"
              placeholder="Filter claims..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </header>

      <main className="ml-60 mt-14 px-10 py-8 max-w-6xl mx-auto space-y-8">
        {loading && (
          <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span className="material-symbols-outlined animate-spin" style={{ color: '#3ecf8e' }}>progress_activity</span>
            Loading analysis...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-64 gap-3" style={{ color: '#ff4444' }}>
            <span className="material-symbols-outlined">error</span>
            Failed to load: {error}
          </div>
        )}

        {job && (
          <>
            {/* Hero header */}
            <section className="flex flex-col md:flex-row md:items-start justify-between gap-6 pt-2">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                    style={{ background: `${verdictColor}18`, color: verdictColor, border: `1px solid ${verdictColor}30` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdictColor }} />
                    {verdictLabel}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tight leading-tight text-white">
                  {job.input_type === 'url'
                    ? job.raw_input.replace(/^https?:\/\//, '').slice(0, 60)
                    : job.raw_input.slice(0, 80) + (job.raw_input.length > 80 ? '…' : '')}
                </h1>
                {job.input_type === 'url' && (
                  <a href={job.raw_input} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm hover:underline"
                    style={{ color: '#3ecf8e' }}>
                    <span className="material-symbols-outlined text-sm">link</span>
                    {job.raw_input}
                  </a>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Truth Score</p>
                <span className="text-6xl font-headline font-black" style={{ color: verdictColor }}>
                  {overallPct}<span className="text-2xl opacity-40">%</span>
                </span>
              </div>
            </section>

            {/* Stats grid */}
            {report && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard count={report.true_count}           label="Verified True"     color="#3ecf8e" />
                <StatCard count={report.false_count}          label="False / Misleading" color="#ff4444" />
                <StatCard count={report.partially_true_count} label="Partial Accuracy"  color="#f59e0b" />
                <StatCard count={report.unverifiable_count}   label="Unverified"        color="rgba(255,255,255,0.2)" />
              </section>
            )}

            {/* AI Authorship + Sources */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 p-6 rounded-2xl"
                style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-base font-headline font-bold text-white mb-1">AI Authorship Analysis</h3>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Linguistic pattern scan & neural signature detection</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl" style={{ color: '#3ecf8e' }}>psychology</span>
                </div>
                {aiPct != null ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-white">AI Written Probability</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span style={{ color: '#3ecf8e' }}>{aiPct}% AI</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{humanPct}% Human</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full transition-all" style={{ width: `${aiPct}%`, background: '#3ecf8e' }} />
                    </div>
                    {report?.ai_text_indicators?.length > 0 && (
                      <p className="text-xs italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Indicators: {report.ai_text_indicators.slice(0, 4).join(' · ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>AI detection data unavailable.</p>
                )}
              </div>

              <div className="p-6 rounded-2xl flex flex-col gap-4"
                style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="text-sm font-bold text-white">Top Sources</h3>
                <div className="space-y-3 flex-1">
                  {uniqueSources.length > 0 ? uniqueSources.map((src, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {src.title || src.source || (src.url || '').replace(/^https?:\/\//, '').split('/')[0]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-bold"
                        style={(src.credibility_score || 0) >= 0.8
                          ? { background: 'rgba(62,207,142,0.1)', color: '#3ecf8e' }
                          : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                        {(src.credibility_score || 0) >= 0.8 ? 'Tier 1' : 'Tier 2'}
                      </span>
                    </div>
                  )) : (
                    <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.25)' }}>No sources available.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Claims list */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-headline font-bold text-white">
                  Claims Analysis
                  <span className="ml-3 text-sm font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {filteredClaims.length} claims
                  </span>
                </h3>
              </div>
              {filteredClaims.length === 0 && (
                <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>No claims match your filter.</p>
              )}
              <div className="space-y-3">
                {filteredClaims.map((claim, i) => (
                  <ClaimCard key={claim.id || i} claim={claim} index={i} />
                ))}
              </div>
            </section>
          </>
        )}

        {!job_id && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <span className="material-symbols-outlined text-5xl">find_in_page</span>
            <p className="text-sm">No job selected. <Link to="/" style={{ color: '#3ecf8e' }} className="hover:underline">Start a new analysis.</Link></p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button onClick={() => navigate('/')}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 z-50"
        style={{ background: '#3ecf8e', color: '#050505' }}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>
    </div>
  );
}
