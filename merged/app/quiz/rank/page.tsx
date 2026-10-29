'use client';
/** Rank board: two segregated leagues, server-verified composite score, evolutionary tiers, 3D podium, FLIP sorting, your-rank bar, radar drawer, erasure + takedown controls. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useHasMounted } from '@/lib/useHasMounted';
import { LegalPanel } from '@/components/quiz/remix/parts';
import { TIERS } from '@/lib/quiz/remix/composite';
import { useQuizMotion } from '@/components/quiz/useQuizMotion';

type League = 'official' | 'community';
type SortKey = 'xp' | 'score' | 'maxStreak' | 'composite';
type Row = { rank: number; nickname: string; composite: number; score: number; accuracy: number; maxStreak: number; xp: number; tier: { id: string; label: string }; questions: number; playerKey: string };

const LEAGUES: { id: League; label: string; blurb: string }[] = [
  { id: 'official', label: '👑 OFFICIAL RANKED LEAGUE', blurb: 'Verified official quizzes and auto-generated Sandbox quizzes with 10 or more questions.' },
  { id: 'community', label: '🛠️ COMMUNITY CUSTOM ARENA', blurb: 'Custom and short quizzes. Kept apart so they can never move the official XP, streak or composite ranking.' },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'xp', label: 'XP' },
  { key: 'score', label: 'Score' },
  { key: 'maxStreak', label: 'Streak' },
  { key: 'composite', label: 'Composite' },
];
const AXES: { label: string; value: (r: Row, max: Maxes) => number }[] = [
  { label: 'XP Volume', value: (r, m) => (m.xp > 0 ? Math.log10(r.xp + 1) / Math.log10(m.xp + 1) : 0) },
  { label: 'Peak Score', value: (r, m) => (m.score > 0 ? r.score / m.score : 0) },
  { label: 'Streak Consistency', value: (r, m) => (m.maxStreak > 0 ? r.maxStreak / m.maxStreak : 0) },
  { label: 'Accuracy Rate', value: (r) => Math.min(1, r.accuracy) },
];
const LOCAL_KEYS = ['evo.quiz.shared.v1', 'evo.quiz.playerKey'];
const SESSION_KEYS = ['evo.remix.session.v1'];
const PLAYER_KEY = 'evo.quiz.playerKey';

type Maxes = { xp: number; score: number; maxStreak: number };

function Skeleton() {
  return <div aria-busy="true" aria-label="Loading rankings">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="rx-skeleton" style={{ height: 38, margin: '8px 0' }} />)}</div>;
}

function Radar({ row, max }: { row: Row; max: Maxes }) {
  const cx = 130, cy = 130, R = 96;
  const points = (scale: number) => AXES.map((_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / AXES.length;
    return `${(cx + Math.cos(a) * R * scale).toFixed(1)},${(cy + Math.sin(a) * R * scale).toFixed(1)}`;
  }).join(' ');
  const shape = AXES.map((ax, i) => {
    const v = Math.max(0, Math.min(1, ax.value(row, max)));
    const a = -Math.PI / 2 + (i * Math.PI * 2) / AXES.length;
    return `${(cx + Math.cos(a) * R * v).toFixed(1)},${(cy + Math.sin(a) * R * v).toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="rk-radar" viewBox="0 0 260 260" role="img" aria-label={`Radar for ${row.nickname}: ${AXES.map((ax) => `${ax.label} ${Math.round(ax.value(row, max) * 100)} percent`).join(', ')}`} style={{ width: '100%', maxWidth: 300 }}>
      {[0.5, 1].map((s) => <polygon key={s} points={points(s)} fill="none" stroke="#334155" strokeWidth="1" />)}
      <polygon className="rk-shape" points={shape} />
      {AXES.map((ax, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / AXES.length;
        const tx = cx + Math.cos(a) * (R + 16), ty = cy + Math.sin(a) * (R + 16);
        return <text key={ax.label} x={tx} y={ty} textAnchor={Math.abs(tx - cx) < 4 ? 'middle' : tx > cx ? 'start' : 'end'} dominantBaseline="middle">{ax.label}</text>;
      })}
    </svg>
  );
}

export default function RankPage() {
  const mounted = useHasMounted();
  const { reduced } = useQuizMotion();
  const [league, setLeague] = useState<League>('official');
  const [sortKey, setSortKey] = useState<SortKey>('composite');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState({ open: false, quizId: '', reason: '' });
  const [myKey, setMyKey] = useState('');
  const [radarRow, setRadarRow] = useState<Row | null>(null);
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const before = useRef(new Map<string, number>());

  const load = useCallback((l: League) => {
    fetch(`/api/quiz/rank?league=${l}&limit=50`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { success: boolean; data?: Row[]; error?: string }) => { if (d.success) { setRows(d.data ?? []); setError(''); } else setError(d.error ?? 'Failed to load rankings'); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(league); }, [league, load]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read this device's player key once on mount
      setMyKey(window.localStorage.getItem(PLAYER_KEY) ?? '');
    } catch { /* blocked storage: no personal bar */ }
  }, []);

  // Sorted view. Composite keeps the server's official rank order.
  const sorted = useMemo(() => {
    const list = [...rows];
    if (sortKey !== 'composite') list.sort((a, b) => b[sortKey] - a[sortKey] || a.rank - b.rank);
    return list;
  }, [rows, sortKey]);
  const maxes: Maxes = useMemo(() => rows.reduce<Maxes>((m, r) => ({ xp: Math.max(m.xp, r.xp), score: Math.max(m.score, r.score), maxStreak: Math.max(m.maxStreak, r.maxStreak) }), { xp: 0, score: 0, maxStreak: 0 }), [rows]);

  // FLIP: capture row positions before a sort change, then glide each row from its old spot to its new one.
  const pickSort = (key: SortKey) => {
    const snap = new Map<string, number>();
    rowEls.current.forEach((el, k) => snap.set(k, el.getBoundingClientRect().top));
    before.current = snap;
    setSortKey(key);
  };
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = new Map();
    if (reduced || prev.size === 0) return;
    rowEls.current.forEach((el, k) => {
      const old = prev.get(k);
      if (old === undefined) return;
      const dy = old - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    });
  }, [sorted, reduced]);

  const clearMyData = async () => {
    if (!window.confirm('Delete your scores from the rank boards and clear data stored on this device (XP, badges, hints, saved game)?')) return;
    let key = '';
    try { key = window.localStorage.getItem(PLAYER_KEY) ?? ''; } catch { /* blocked */ }
    let removed = 0;
    if (key) {
      try {
        const r = await fetch('/api/quiz/rank?action=erase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerKey: key }) });
        removed = ((await r.json()) as { removed?: number }).removed ?? 0;
      } catch { /* offline: local wipe still happens */ }
    }
    try { LOCAL_KEYS.forEach((k) => window.localStorage.removeItem(k)); SESSION_KEYS.forEach((k) => window.sessionStorage.removeItem(k)); } catch { /* blocked */ }
    setMsg(`Done. ${removed} leaderboard ${removed === 1 ? 'entry' : 'entries'} removed and local data cleared. Xóa dữ liệu thành công.`);
    setMyKey('');
    setLoading(true); load(league);
  };
  const sendReport = async () => {
    if (!report.quizId.trim()) { setMsg('Enter the quiz name or ID to report.'); return; }
    try {
      const r = await fetch('/api/quiz/rank?action=report_quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: report.quizId, reason: report.reason }) });
      setMsg(r.ok ? 'Thank you. The quiz is hidden from public listings while it is reviewed.' : 'Could not send the report. Try again shortly.');
      if (r.ok) setReport({ open: false, quizId: '', reason: '' });
    } catch { setMsg('Network error. Try again.'); }
  };

  const top = sorted.slice(0, 3);
  const me = myKey ? sorted.findIndex((r) => r.playerKey === myKey) : -1;
  const mine = me >= 0 ? sorted[me] : undefined;
  const above = me > 0 ? sorted[me - 1] : undefined;
  const sortLabel = SORTS.find((s) => s.key === sortKey)!.label;
  const gap = above && mine ? Math.max(0, above[sortKey] - mine[sortKey]) : 0;
  const verified = league === 'official';

  const pillar = (r: Row | undefined, cls: string, crown?: boolean) => (r ? (
    <div className={`rk-pillar ${cls}`}>
      {crown && <span className="rk-crown" aria-hidden="true">👑</span>}
      <div className="rk-name">#{sorted.indexOf(r) + 1} {r.nickname}{verified && <span className="rk-verified">Verified League</span>}</div>
      <div className="rk-big">{r.composite}</div>
      <div>{r.tier.label}</div>
    </div>
  ) : <div className={`rk-pillar ${cls}`} style={{ opacity: 0.35 }}><div className="rk-name">—</div></div>);

  return (
    <main id="main" className="rk-root">
      <div className="rk-wrap">
        <h1>Rank Board</h1>
        <p className="rk-formula">Composite = Score<sub>norm</sub>×0.40 + Accuracy²×1000×0.25 + min(Streak,50)×20×0.20 + min(1000, log₁₀(XP+1)×250)×0.15. Computed on the server from a signed game session.</p>

        <div className="rk-league" role="tablist" aria-label="League" data-idx={league === 'official' ? 0 : 1}>
          <span className="rk-thumb" aria-hidden="true" style={{ transform: `translateX(${league === 'official' ? 0 : 100}%)` }} />
          {LEAGUES.map((l) => <button key={l.id} role="tab" type="button" className="rk-tab" aria-selected={league === l.id} onClick={() => { setLoading(true); setLeague(l.id); }}>{l.label}</button>)}
        </div>
        <p>{LEAGUES.find((l) => l.id === league)!.blurb}</p>

        {error && <p role="alert" style={{ color: '#fda4af' }}>{error} <button type="button" className="rx-btn" onClick={() => { setLoading(true); load(league); }}>Retry</button></p>}

        {loading ? <Skeleton /> : rows.length === 0 ? (
          <p>No verified runs here yet. <Link href="/quiz/remix?autostart=1" className="rx-deeplink">Play a Sandbox Remix quiz</Link> to claim the first spot.</p>
        ) : (
          <>
            <div className="rk-podium" aria-label="Top three">{pillar(top[1], 'rk-p2')}{pillar(top[0], 'rk-p1', true)}{pillar(top[2], 'rk-p3')}</div>
            <div className="rk-sort" role="group" aria-label="Sort by">
              {SORTS.map((s) => <button key={s.key} type="button" className="rk-tab" aria-pressed={sortKey === s.key} onClick={() => pickSort(s.key)}>{s.label}</button>)}
            </div>
            <table className="rk-table">
              <thead><tr><th>#</th><th>Explorer</th><th>Tier</th><th>Composite</th><th>Score</th><th>Accuracy</th><th>Streak</th><th>XP</th><th><span className="sr-only">Details</span></th></tr></thead>
              <tbody>
                {sorted.map((r, i) => {
                  const k = `${r.playerKey}:${r.rank}`;
                  return (
                    <tr key={k} ref={(el) => { if (el) rowEls.current.set(k, el); else rowEls.current.delete(k); }} aria-current={r.playerKey === myKey ? 'true' : undefined}>
                      <td>{sortKey === 'composite' ? r.rank : i + 1}</td>
                      <td>{r.nickname}{verified && <span className="rk-verified">Verified League</span>}</td>
                      <td>{r.tier.label}</td>
                      <td><b>{r.composite}</b></td>
                      <td>{r.score}</td>
                      <td>{Math.round(r.accuracy * 100)}%</td>
                      <td>{r.maxStreak}</td>
                      <td>{r.xp}</td>
                      <td><button type="button" className="rx-btn" aria-haspopup="dialog" onClick={() => setRadarRow(r)}>Radar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <details className="rx-legal" style={{ marginTop: 18 }}>
          <summary>Evolutionary rank tiers</summary>
          <ul>{TIERS.map((t) => <li key={t.id}>{t.label}: composite {t.id === 'singularity' ? '≥ 850 and Top 10' : t.id === 'proto' ? '< 300' : t.id === 'cambrian' ? '300 – 599' : '600 – 849'}</li>)}</ul>
        </details>

        <div className="rk-actions">
          {mounted && <button type="button" className="rx-btn" onClick={() => void clearMyData()}>🗑️ Xóa Dữ Liệu Cá Nhân / Clear My Data</button>}
          {league === 'community' && <button type="button" className="rx-btn alt" onClick={() => setReport((r) => ({ ...r, open: !r.open }))}>🚩 Report Quiz</button>}
          <Link className="rx-btn" href="/quiz/remix">Play Sandbox Remix</Link>
        </div>
        {report.open && (
          <div className="rx-card" style={{ maxWidth: 520, borderColor: '#f59e0b' }}>
            <label>Quiz name or ID<br /><input className="rx-input" maxLength={80} value={report.quizId} onChange={(e) => setReport({ ...report, quizId: e.target.value })} /></label>
            <label><br />What is wrong with it?<br /><input className="rx-input" maxLength={300} value={report.reason} onChange={(e) => setReport({ ...report, reason: e.target.value })} /></label>
            <div className="rx-row"><button type="button" className="rx-btn" onClick={() => void sendReport()}>Send report (hides it now)</button></div>
          </div>
        )}
        {msg && <p role="status">{msg}</p>}
        <LegalPanel />
      </div>

      {radarRow && (
        <div className="rk-drawer-wrap" onClick={() => setRadarRow(null)}>
          <aside className="rk-drawer" role="dialog" aria-modal="true" aria-label={`Radar for ${radarRow.nickname}`} onClick={(e) => e.stopPropagation()}>
            <div className="rk-row-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ margin: 0 }}>{radarRow.nickname}</h2>
              <button type="button" className="rx-btn rk-drawer-close" onClick={() => setRadarRow(null)}>Close</button>
            </div>
            <p>{radarRow.tier.label} · composite {radarRow.composite}</p>
            <Radar row={radarRow} max={maxes} />
            <ul>{AXES.map((ax) => <li key={ax.label}>{ax.label}: {Math.round(ax.value(radarRow, maxes) * 100)}%</li>)}</ul>
          </aside>
        </div>
      )}

      {mine && (
        <div className="rk-sticky" role="status" aria-live="polite">
          <span><strong>Your rank #{me + 1}</strong> · {sortLabel}</span>
          <span>{above ? `${gap} pts to pass #${me}` : 'You hold the top spot here'}</span>
        </div>
      )}
    </main>
  );
}
