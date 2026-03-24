import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

const API_BASE = 'http://localhost:8000';

const PIPELINE_STAGES = ['pending', 'extracting', 'searching', 'verifying', 'complete'];

const VERDICT_CONFIG = {
  true:           { label: 'True',         dot: '#3ecf8e', text: '#3ecf8e',  bar: '#3ecf8e',  bg: 'rgba(62,207,142,0.08)',  border: 'rgba(62,207,142,0.2)' },
  false:          { label: 'False',        dot: '#ff4444', text: '#ff4444',  bar: '#ff4444',  bg: 'rgba(255,68,68,0.08)',   border: 'rgba(255,68,68,0.2)' },
  partially_true: { label: 'Partial',      dot: '#f59e0b', text: '#f59e0b',  bar: '#f59e0b',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  unverifiable:   { label: 'Unverifiable', dot: '#555',    text: 'rgba(255,255,255,0.4)', bar: '#555', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
};

const NAV = [
  { icon: 'dashboard', label: 'Dashboard',  to: '/' },
  { icon: 'sensors',   label: 'Live Check', to: '/live', active: true },
  { icon: 'history',   label: 'History',    to: '/history' },
  { icon: 'settings',  label: 'Settings',   to: '#' },
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
        {NAV.map(({ icon, label, to, active }) => (
          <Link key={label} to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={active ? { background: 'rgba(62,207,142,0.1)', color: '#3ecf8e' } : { color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; } }}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-1">
        <button onClick={onNewAnalysis}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 mb-3"
          style={{ background: 'rgba(62,207,142,0.12)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)' }}>
          New Verification
        </button>
      </div>
    </aside>
  );
}

function ClaimCard({ claim, index }) {
  const v = VERDICT_CONFIG[claim.verdict] || VERDICT_CONFIG.unverifiable;
  const confPct = Math.round(claim.confidence_score * 100);
  return (
    <div className="p-4 rounded-xl transition-all"
      style={{ background: v.bg, border: `1px solid ${v.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.dot }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: v.text }}>{v.label}</span>
        </div>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>#{index + 1}</span>
      </div>
      <p className="text-sm leading-relaxed text-white mb-3">"{claim.claim_text}"</p>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${confPct}%`, background: v.bar }} />
          </div>
        </div>
        <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{confPct}%</span>
      </div>
    </div>
  );
}

export default function VerifyLive() {
  const location = useLocation();
  const navigate = useNavigate();

  const stateJobId = location.state?.job_id;
  const urlJobId = new URLSearchParams(location.search).get('job_id');
  const passedContent = location.state?.content;
  const passedInputType = location.state?.inputType || 'text';

  const [jobId, setJobId] = useState(stateJobId || urlJobId || null);
  const [status, setStatus] = useState('pending');
  const [statusMessage, setStatusMessage] = useState('Initialising...');
  const [claims, setClaims] = useState([]);
  const [extractedCount, setExtractedCount] = useState(0);
  const [overallScore, setOverallScore] = useState(null);
  const [trueCt, setTrueCt] = useState(0);
  const [falseCt, setFalseCt] = useState(0);
  const [aiProb, setAiProb] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const claimsEndRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => { claimsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [claims]);

  useEffect(() => {
    if (jobId || !passedContent) return;
    setSubmitting(true);
    fetch(`${API_BASE}/api/verify/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_type: passedInputType, content: passedContent }),
    })
      .then(r => r.json())
      .then(data => { setJobId(data.job_id); setSubmitting(false); })
      .catch(e => { setError(`Failed to submit: ${e.message}`); setSubmitting(false); });
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`${API_BASE}/api/jobs/${jobId}/stream/`);
    sourceRef.current = es;
    es.addEventListener('status', e => { const d = JSON.parse(e.data); setStatus(d.status); setStatusMessage(d.message || d.status); });
    es.addEventListener('claim_extracted', () => setExtractedCount(c => c + 1));
    es.addEventListener('claim_verified', e => {
      const d = JSON.parse(e.data);
      setClaims(prev => [{ claim_text: d.claim, verdict: d.verdict, confidence_score: d.confidence_score, sources: [] }, ...prev]);
      if (d.verdict === 'true') setTrueCt(c => c + 1);
      if (d.verdict === 'false') setFalseCt(c => c + 1);
    });
    es.addEventListener('complete', e => {
      const d = JSON.parse(e.data);
      setStatus('complete');
      setOverallScore(d.overall_score ?? d.report?.overall_score ?? null);
      setAiProb(d.ai_text_probability ?? d.report?.ai_text_probability ?? null);
      if (d.true_count != null) setTrueCt(d.true_count);
      if (d.false_count != null) setFalseCt(d.false_count);
      es.close();
    });
    es.addEventListener('error', e => {
      try { const d = JSON.parse(e.data); setError(d.message); } catch { setError('Stream error'); }
      setStatus('failed'); es.close();
    });
    es.onerror = () => { if (es.readyState === EventSource.CLOSED) return; setError('Connection lost'); setStatus('failed'); es.close(); };
    return () => es.close();
  }, [jobId]);

  const stageIndex = PIPELINE_STAGES.indexOf(status === 'failed' ? 'pending' : status);
  const scorePct = overallScore != null ? Math.round(overallScore * 100) : null;
  const aiPct = aiProb != null ? Math.round(aiProb * 100) : null;
  const conicDeg = scorePct != null ? Math.round(scorePct * 3.6) : 0;

  const STAGE_LABELS = ['Pending', 'Extracting', 'Searching', 'Verifying', 'Complete'];

  return (
    <div className="min-h-screen font-body" style={{ background: '#050505', color: '#fff' }}>
      <Sidebar onNewAnalysis={() => navigate('/')} />

      {/* Header */}
      <header className="fixed top-0 right-0 left-60 h-14 z-40 flex items-center justify-between px-8"
        style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Live Verification</span>
          {jobId && (
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              {jobId.slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: status === 'failed' ? '#ff4444' : status === 'complete' ? '#3ecf8e' : 'rgba(255,255,255,0.5)' }}>
            <span className={`w-1.5 h-1.5 rounded-full ${status !== 'complete' && status !== 'failed' ? 'animate-pulse' : ''}`}
              style={{ background: status === 'failed' ? '#ff4444' : status === 'complete' ? '#3ecf8e' : '#3ecf8e' }} />
            {status === 'failed' ? 'Error' : status === 'complete' ? 'Complete' : 'Live'}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ml-60 mt-14 p-8 min-h-[calc(100vh-3.5rem)]">
        {/* Spinner while submitting */}
        {submitting && (
          <div className="flex items-center gap-3 text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="material-symbols-outlined animate-spin text-lg" style={{ color: '#3ecf8e' }}>progress_activity</span>
            Submitting job...
          </div>
        )}

        {!jobId && !submitting && !passedContent && (
          <div className="flex flex-col items-center justify-center h-64 gap-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span className="material-symbols-outlined text-5xl">sensors_off</span>
            <p className="text-sm">No active job. <Link to="/" style={{ color: '#3ecf8e' }} className="hover:underline">Start a new verification.</Link></p>
          </div>
        )}

        {(jobId || submitting) && (
          <>
            {/* Pipeline stepper */}
            <section className="mb-8">
              <div className="p-5 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#3ecf8e' }}>Pipeline</p>
                    <h2 className="text-lg font-headline font-bold text-white">{statusMessage}</h2>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PIPELINE_STAGES.map((stage, i) => {
                      const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending';
                      return (
                        <div key={stage} className="flex items-center gap-1">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                            style={state === 'active'
                              ? { background: 'rgba(62,207,142,0.12)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.25)' }
                              : state === 'done'
                              ? { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }
                              : { color: 'rgba(255,255,255,0.2)' }}>
                            {state === 'done' && <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1", color: '#3ecf8e' }}>check_circle</span>}
                            {state === 'active' && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                            {state === 'pending' && <span className="w-1 h-1 rounded-full inline-block" style={{ background: 'rgba(255,255,255,0.2)' }} />}
                            {STAGE_LABELS[i]}
                          </div>
                          {i < PIPELINE_STAGES.length - 1 && (
                            <div className="w-4 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {error && (
              <div className="flex items-center gap-3 text-sm px-4 py-3 rounded-xl mb-6"
                style={{ background: 'rgba(255,68,68,0.08)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' }}>
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            <div className="grid grid-cols-12 gap-6">
              {/* Left panel */}
              <div className="col-span-4 flex flex-col gap-4">

                {/* Score ring */}
                <div className="p-6 rounded-2xl flex flex-col items-center text-center"
                  style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Reliability Score
                  </p>
                  <div className="relative w-28 h-28 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `conic-gradient(#3ecf8e ${conicDeg}deg, rgba(255,255,255,0.05) 0)` }}>
                    <div className="absolute w-[88px] h-[88px] rounded-full" style={{ background: '#0f0f0f' }} />
                    <div className="relative z-10 text-center">
                      <span className="text-3xl font-headline font-extrabold text-white">
                        {scorePct != null ? `${scorePct}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {claims.length > 0 ? <>{claims.length} claims analysed</> : 'Waiting for claims...'}
                  </p>
                </div>

                {/* Stats */}
                <div className="p-5 rounded-2xl space-y-4"
                  style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Detection</p>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-white">AI Probability</span>
                      <span className="text-sm font-bold font-headline" style={{ color: '#3ecf8e' }}>
                        {aiPct != null ? `${aiPct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${aiPct ?? 0}%`, background: '#3ecf8e' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.15)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(62,207,142,0.7)' }}>True</p>
                      <p className="text-2xl font-headline font-bold text-white">{String(trueCt).padStart(2, '0')}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.15)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,68,68,0.7)' }}>False</p>
                      <p className="text-2xl font-headline font-bold" style={{ color: '#ff4444' }}>{String(falseCt).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>

                {/* Extracted count */}
                {extractedCount > 0 && (
                  <div className="p-4 rounded-xl flex items-center gap-3"
                    style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="material-symbols-outlined text-lg" style={{ color: '#3ecf8e' }}>format_list_bulleted</span>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Claims Found</p>
                      <p className="text-xl font-headline font-bold text-white">{extractedCount}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right panel — claims stream */}
              <div className="col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Claims</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(62,207,142,0.1)', color: '#3ecf8e' }}>
                      {claims.length}
                    </span>
                  </div>
                  {status !== 'complete' && status !== 'failed' && (
                    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#3ecf8e' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3ecf8e' }} />
                      Streaming live
                    </div>
                  )}
                </div>

                <div className="space-y-3 overflow-y-auto pr-1"
                  style={{ maxHeight: 'calc(100vh - 22rem)', scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a transparent' }}>
                  {claims.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center h-40 gap-3"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <span className="material-symbols-outlined text-4xl animate-pulse">sensors</span>
                      <p className="text-xs uppercase tracking-widest">Waiting for claims...</p>
                    </div>
                  )}
                  {claims.map((claim, i) => (
                    <ClaimCard key={i} claim={claim} index={claims.length - 1 - i} />
                  ))}
                  <div ref={claimsEndRef} />
                </div>

                {/* CTA */}
                <div className="pt-2 flex justify-center">
                  <button
                    disabled={status !== 'complete'}
                    onClick={() => navigate(`/detail/${jobId}`)}
                    className="flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={status === 'complete'
                      ? { background: '#3ecf8e', color: '#050505' }
                      : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="material-symbols-outlined text-lg">assignment_turned_in</span>
                    {status === 'complete' ? 'View Full Analysis' : 'Processing...'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
