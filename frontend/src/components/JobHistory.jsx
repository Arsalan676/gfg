import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = 'http://localhost:8000';

const STATUS_CONFIG = {
  complete:   { label: 'Complete', color: '#3ecf8e', bg: 'rgba(62,207,142,0.1)',  border: 'rgba(62,207,142,0.2)' },
  failed:     { label: 'Failed',   color: '#ff4444', bg: 'rgba(255,68,68,0.1)',   border: 'rgba(255,68,68,0.2)' },
  pending:    { label: 'Pending',  color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
  extracting: { label: 'Running',  color: '#3ecf8e', bg: 'rgba(62,207,142,0.08)', border: 'rgba(62,207,142,0.15)' },
  searching:  { label: 'Running',  color: '#3ecf8e', bg: 'rgba(62,207,142,0.08)', border: 'rgba(62,207,142,0.15)' },
  verifying:  { label: 'Running',  color: '#3ecf8e', bg: 'rgba(62,207,142,0.08)', border: 'rgba(62,207,142,0.15)' },
};

const NAV = [
  { icon: 'dashboard', label: 'Dashboard',  to: '/' },
  { icon: 'sensors',   label: 'Live Check', to: '/live' },
  { icon: 'history',   label: 'History',    to: '/history', active: true },
  { icon: 'settings',  label: 'Settings',   to: '#' },
];

function Sidebar() {
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
      <div className="px-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
        <Link to="/"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(62,207,142,0.12)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)' }}>
          <span className="material-symbols-outlined text-lg">add</span>
          New Verification
        </Link>
      </div>
    </aside>
  );
}

function ScoreRing({ score }) {
  const pct = score != null ? Math.round(score * 100) : null;
  const r = 13;
  const circ = 2 * Math.PI * r;
  const offset = pct != null ? circ * (1 - pct / 100) : circ;
  return (
    <div className="w-9 h-9 flex items-center justify-center relative flex-shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="transparent" r={r} strokeWidth="2" style={{ stroke: 'rgba(255,255,255,0.06)' }} />
        {pct != null && (
          <circle cx="18" cy="18" fill="transparent" r={r} strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ stroke: '#3ecf8e' }} />
        )}
      </svg>
      <span className="relative text-[9px] font-bold z-10 text-white">{pct != null ? pct : '—'}</span>
    </div>
  );
}

function HistoryRow({ job, onDetails }) {
  const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const isUrl = job.input_type === 'url';
  const label = isUrl
    ? job.raw_input.replace(/^https?:\/\//, '').slice(0, 65)
    : job.raw_input.slice(0, 65) + (job.raw_input.length > 65 ? '…' : '');

  const ts = new Date(job.created_at);
  const now = new Date();
  const diffH = Math.floor((now - ts) / 3600000);
  const timeLabel = diffH < 1 ? 'Just now' : diffH < 24 ? `${diffH}h ago` : diffH < 48 ? 'Yesterday' : `${Math.floor(diffH / 24)}d ago`;

  return (
    <div className="grid items-center px-5 py-4 transition-colors group cursor-pointer"
      style={{ gridTemplateColumns: '44px 1fr 110px 120px 48px 100px', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div className="flex justify-center">
        <span className="material-symbols-outlined text-lg" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {isUrl ? 'link' : 'description'}
        </span>
      </div>
      <div className="flex flex-col min-w-0 pr-4">
        <span className="text-sm font-medium text-white truncate">{label}</span>
        <span className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {isUrl ? 'URL' : 'Text'}
        </span>
      </div>
      <div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
          {sc.label}
        </span>
      </div>
      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{timeLabel}</div>
      <div><ScoreRing score={job.report?.overall_score ?? null} /></div>
      <div className="text-right">
        <button onClick={() => onDetails(job.id)}
          className="flex items-center gap-1 text-xs font-semibold ml-auto transition-all group-hover:gap-2"
          style={{ color: '#3ecf8e' }}>
          Details
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

const FILTERS = ['All', 'Complete', 'Failed', 'Running'];
const PAGE_SIZE = 10;

export default function JobHistory() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`${API_BASE}/api/jobs/`)
      .then(r => r.json())
      .then(data => { setJobs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => {
    const matchSearch = !search || j.raw_input.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All' ? true :
      filter === 'Complete' ? j.status === 'complete' :
      filter === 'Failed' ? j.status === 'failed' :
      filter === 'Running' ? !['complete', 'failed'].includes(j.status) : true;
    return matchSearch && matchFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const completedJobs = jobs.filter(j => j.status === 'complete');
  const failedJobs = jobs.filter(j => j.status === 'failed');

  return (
    <div className="min-h-screen font-body" style={{ background: '#050505', color: '#fff' }}>
      <Sidebar />

      {/* Header */}
      <header className="fixed top-0 right-0 left-60 h-14 z-40 flex items-center justify-between px-8"
        style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-semibold text-white">Verification History</span>
        <div className="flex items-center gap-3">
          <button className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}>
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>
        </div>
      </header>

      <main className="ml-60 mt-14 px-8 py-8 flex flex-col gap-7">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h2 className="text-3xl font-headline font-extrabold tracking-tight text-white">History</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>All processed verification jobs</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',     value: jobs.length,           color: '#fff' },
              { label: 'Completed', value: completedJobs.length,  color: '#3ecf8e' },
              { label: 'Failed',    value: failedJobs.length,     color: '#ff4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 rounded-xl text-center"
                style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                <span className="text-2xl font-headline font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Filter + search */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={filter === f
                  ? { background: '#3ecf8e', color: '#050505' }
                  : { color: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={e => { if (filter !== f) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (filter !== f) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm flex items-center px-4 py-2 rounded-xl"
            style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="material-symbols-outlined text-sm mr-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>search</span>
            <input className="bg-transparent border-none text-sm outline-none placeholder:text-white/25 w-full text-white"
              placeholder="Search jobs..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Table head */}
          <div className="grid items-center px-5 py-3 text-[10px] uppercase tracking-widest font-bold"
            style={{ gridTemplateColumns: '44px 1fr 110px 120px 48px 100px', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span>Type</span>
            <span>Job</span>
            <span>Status</span>
            <span>Time</span>
            <span>Score</span>
            <span className="text-right">Action</span>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-40 gap-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <span className="material-symbols-outlined animate-spin" style={{ color: '#3ecf8e' }}>progress_activity</span>
              Loading history...
            </div>
          )}

          {!loading && paginated.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <span className="material-symbols-outlined text-4xl">search_off</span>
              <p className="text-xs uppercase tracking-widest">No jobs found</p>
            </div>
          )}

          {paginated.map(job => (
            <HistoryRow key={job.id} job={job} onDetails={id => navigate(`/detail/${id}`)} />
          ))}

          {/* Pagination */}
          <div className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {paginated.length} of {filtered.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all"
                  style={page === n
                    ? { background: '#3ecf8e', color: '#050505' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        {/* Bottom bento */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-8">
          <div className="md:col-span-2 p-6 rounded-2xl flex items-center gap-8"
            style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex-1">
              <h3 className="font-headline font-bold text-lg text-white mb-2">Keep verifying</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {completedJobs.length > 0
                  ? `${completedJobs.length} completed verifications in your archive.`
                  : 'No completed verifications yet. Submit your first job.'}
              </p>
              <Link to="/" className="flex items-center gap-2 text-xs font-bold hover:gap-3 transition-all"
                style={{ color: '#3ecf8e' }}>
                START NEW VERIFICATION
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
            <div className="hidden lg:block w-24 h-24 relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(62,207,142,0.08)', filter: 'blur(16px)' }} />
              <div className="relative w-full h-full rounded-full border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: 'rgba(62,207,142,0.25)' }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: '#3ecf8e', fontVariationSettings: "'FILL' 1" }}>security</span>
              </div>
            </div>
          </div>
          <div className="p-6 rounded-2xl flex flex-col justify-between"
            style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="font-headline font-bold text-base text-white mb-1">Vault</h3>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {jobs.length} records
              </p>
            </div>
            <div>
              <div className="h-1.5 w-full rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${jobs.length > 0 ? Math.min(100, (completedJobs.length / jobs.length) * 100) : 0}%`,
                  background: '#3ecf8e',
                }} />
              </div>
              <div className="flex justify-between">
                <p className="text-[10px] italic" style={{ color: 'rgba(255,255,255,0.25)' }}>Completion rate</p>
                <p className="text-xs font-bold text-white">
                  {jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Status toast */}
      <div className="fixed bottom-5 right-5 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl z-50"
        style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3ecf8e' }} />
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {loading ? 'Loading...' : `${jobs.length} verification records`}
        </span>
      </div>
    </div>
  );
}
