'use client';
/** Rank board: two segregated leagues, server-verified composite score, evolutionary tiers, holographic podium, erasure + takedown controls. */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useHasMounted } from '@/lib/useHasMounted';
import { LegalPanel } from '@/components/quiz/remix/parts';
import { TIERS } from '@/lib/quiz/remix/composite';

type League = 'official' | 'community';
type Row = { rank: number; nickname: string; composite: number; score: number; accuracy: number; maxStreak: number; xp: number; tier: { id: string; label: string }; questions: number; playerKey: string };

const LEAGUES: { id: League; label: string; blurb: string }[] = [
  { id: 'official', label: '👑 OFFICIAL RANKED LEAGUE', blurb: 'Verified official quizzes and auto-generated Sandbox quizzes with 10 or more questions.' },
  { id: 'community', label: '🛠️ COMMUNITY CUSTOM ARENA', blurb: 'Custom and short quizzes. Kept apart so they can never move the official XP, streak or composite ranking.' },
];
const LOCAL_KEYS = ['evo.quiz.shared.v1', 'evo.quiz.playerKey'];
const SESSION_KEYS = ['evo.remix.session.v1'];

function Skeleton() {
  return <div aria-busy="true" aria-label="Loading rankings">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="rx-skeleton" style={{ height: 38, margin: '8px 0' }} />)}</div>;
}

export default function RankPage() {
  const mounted = useHasMounted();
  const [league, setLeague] = useState<League>('official');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState({ open: false, quizId: '', reason: '' });

  const load = useCallback((l: League) => {
    fetch(`/api/quiz/rank?league=${l}&limit=50`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { success: boolean; data?: Row[]; error?: string }) => { if (d.success) { setRows(d.data ?? []); setError(''); } else setError(d.error ?? 'Failed to load rankings'); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(league); }, [league, load]);

  const clearMyData = async () => {
    if (!window.confirm('Delete your scores from the rank boards and clear data stored on this device (XP, badges, hints, saved game)?')) return;
    let key = '';
    try { key = window.localStorage.getItem('evo.quiz.playerKey') ?? ''; } catch { /* blocked */ }
    let removed = 0;
    if (key) {
      try {
        const r = await fetch('/api/quiz/rank?action=erase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerKey: key }) });
        removed = ((await r.json()) as { removed?: number }).removed ?? 0;
      } catch { /* offline: local wipe still happens */ }
    }
    try { LOCAL_KEYS.forEach((k) => window.localStorage.removeItem(k)); SESSION_KEYS.forEach((k) => window.sessionStorage.removeItem(k)); } catch { /* blocked */ }
    setMsg(`Done. ${removed} leaderboard ${removed === 1 ? 'entry' : 'entries'} removed and local data cleared. Xóa dữ liệu thành công.`);
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

  const top = rows.slice(0, 3);
  const pillar = (r: Row | undefined, cls: string, crown?: boolean) => (r ? (
    <div className={`rk-pillar ${cls}`}>{crown && <span className="rk-crown" aria-hidden="true">👑</span>}<div className="rk-name">#{r.rank} {r.nickname}</div><div className="rk-big">{r.composite}</div><div>{r.tier.label}</div></div>
  ) : <div className={`rk-pillar ${cls}`} style={{ opacity: 0.35 }}><div className="rk-name">—</div></div>);

  return (
    <main id="main" className="rk-root">
      <div className="rk-wrap">
        <h1>Rank Board</h1>
        <p className="rk-formula">Composite = Score<sub>norm</sub>×0.40 + Accuracy²×1000×0.25 + min(Streak,50)×20×0.20 + min(1000, log₁₀(XP+1)×250)×0.15. Computed on the server from a signed game session.</p>

        <div className="rk-tabs" role="tablist" aria-label="League">
          {LEAGUES.map((l) => <button key={l.id} role="tab" type="button" className="rk-tab" aria-selected={league === l.id} onClick={() => { setLoading(true); setLeague(l.id); }}>{l.label}</button>)}
        </div>
        <p>{LEAGUES.find((l) => l.id === league)!.blurb}</p>

        {error && <p role="alert" style={{ color: '#fda4af' }}>{error} <button type="button" className="rx-btn" onClick={() => { setLoading(true); load(league); }}>Retry</button></p>}

        {loading ? <Skeleton /> : rows.length === 0 ? (
          <p>No verified runs here yet. <Link href="/quiz/remix?autostart=1" className="rx-deeplink">Play a Sandbox Remix quiz</Link> to claim the first spot.</p>
        ) : (
          <>
            <div className="rk-podium" aria-label="Top three">{pillar(top[1], 'rk-p2')}{pillar(top[0], 'rk-p1', true)}{pillar(top[2], 'rk-p3')}</div>
            <table className="rk-table">
              <thead><tr><th>#</th><th>Explorer</th><th>Tier</th><th>Composite</th><th>Score</th><th>Accuracy</th><th>Streak</th><th>XP</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.playerKey + r.rank}><td>{r.rank}</td><td>{r.nickname}</td><td>{r.tier.label}</td><td><b>{r.composite}</b></td><td>{r.score}</td><td>{Math.round(r.accuracy * 100)}%</td><td>{r.maxStreak}</td><td>{r.xp}</td></tr>)}</tbody>
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
    </main>
  );
}
