'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveToken } from '@/lib/quiz/client';
import { allowedFlows, defaultFlow, modifierAvailability } from '@/lib/quiz/compatibility';
import Image from 'next/image';
import { modeInfo } from '@/lib/quiz/mode-info';
import { MODIFIERS, flowLabels, modeLabels, modifierDescriptions, modifierLabels, type Flow, type Modifier, type PlayMode } from '@/lib/quiz/types';

const MODE_HELP: Record<PlayMode, string> = {
  solo: 'Just you, at your own pace, against the clock.',
  classroom: 'One teacher computer and a projector. Students sit in teams — no student devices or accounts.',
  online: 'Players join from their own devices with a room code.',
};

export default function GameSetup({ quizId, quizTitle, questionCount, signedIn, initialMode = null }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean; initialMode?: PlayMode | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode | null>(initialMode);
  const [flow, setFlow] = useState<Flow | null>(initialMode ? defaultFlow(initialMode) : null);
  const [mods, setMods] = useState<Modifier[]>([]);
  const [minutes, setMinutes] = useState(15);
  const [qSeconds, setQSeconds] = useState(45);
  const [noTimer, setNoTimer] = useState(false);
  const [slotLimit, setSlotLimit] = useState(3);
  const [teams, setTeams] = useState(['Team 1', 'Team 2', 'Team 3', 'Team 4']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const needsAccount = mode !== null && mode !== 'solo' && !signedIn;
  const split = useMemo(() => {
    if (!mode || !flow) return { ok: [] as Modifier[], no: [] as { m: Modifier; reason: string }[] };
    const ok: Modifier[] = [], no: { m: Modifier; reason: string }[] = [];
    for (const m of MODIFIERS) { const a = modifierAvailability(mode, flow, m); if (a.ok) ok.push(m); else no.push({ m, reason: a.reason }); }
    return { ok, no };
  }, [mode, flow]);

  function pickMode(m: PlayMode) { setMode(m); const f = defaultFlow(m); setFlow(f); setMods([]); setError(''); }
  function pickFlow(f: Flow) { setFlow(f); setMods([]); }

  async function launch() {
    if (!mode || !flow) return;
    setBusy(true); setError('');
    try {
      const d = await api<{ roomId: string; token?: string }>('/api/quiz/rooms/create', { method: 'POST', json: {
        quizId, mode, flow, durationSeconds: minutes * 60, questionSeconds: noTimer ? null : qSeconds, modifiers: mods, slotLimit,
        teamNames: mode === 'classroom' ? teams.map((t) => t.trim()) : [],
      } });
      if (mode === 'solo' && d.token) { saveToken(d.roomId, d.token); router.push(`/quiz/play/${d.roomId}`); }
      else router.push(`/quiz/host/${d.roomId}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div><p className="eyebrow">Game Settings</p><h1>{quizTitle}</h1><p className="muted-text">{questionCount} question{questionCount === 1 ? '' : 's'} · Game mode: <strong>Classic Quiz</strong></p></div>
        <Link className="btn ghost" href="/quiz/library">Quiz Library</Link>
      </header>

      <section className="panel stack" aria-labelledby="s-how">
        <p className="eyebrow">Step 1</p><h2 id="s-how">Choose a Game Mode</h2>
        <div className="choices">{(['solo', 'classroom', 'online'] as PlayMode[]).map((m) => (
          <button key={m} className="choice" aria-pressed={mode === m} onClick={() => pickMode(m)}><strong>{modeLabels[m]}</strong><small>{MODE_HELP[m]}</small></button>
        ))}</div>
        {needsAccount && <p className="info">Hosting a {mode} game needs an account so you can control the room. <Link href={`/quiz/login?next=/quiz/setup/${quizId}`}>Sign in or create one</Link>. Solo play needs no account.</p>}
        {mode && <div className="qz-side-art" style={{ marginTop: 6, marginBottom: 0 }}><Image src={modeInfo(mode).art} alt="" width={1200} height={675} unoptimized /></div>}
      </section>

      {mode && flow && (
        <>
          <section className="panel stack" aria-labelledby="s-mode">
            <p className="eyebrow">Step 2</p><h2 id="s-mode">Question Flow</h2>
            <p className="muted-text">Classic Quiz is played with {modeLabels[mode].toLowerCase()}. Pick how questions are delivered:</p>
            {allowedFlows(mode).length === 1
              ? <p><strong>{flowLabels[flow]}</strong></p>
              : <div className="choices">{allowedFlows(mode).map((f) => <button key={f} className="choice" aria-pressed={flow === f} onClick={() => pickFlow(f)}><strong>{flowLabels[f].split(' — ')[0]}</strong><small>{flowLabels[f].split(' — ')[1]}</small></button>)}</div>}
          </section>

          <section className="panel stack" aria-labelledby="s-mods">
            <p className="eyebrow">Step 3 · Optional</p><h2 id="s-mods">Modifiers</h2>
            <p className="note" style={{ margin: 0 }}>Shown for {modeLabels[mode].toLowerCase()} with the {flow.replace('_', ' ')} flow.</p>
            <p className="muted-text">Only modifiers that work with this setup are offered. Points are the only currency. All are off by default.</p>
            {split.ok.map((m) => (
              <label key={m} className="modifier">
                <input type="checkbox" checked={mods.includes(m)} onChange={(e) => setMods((xs) => (e.target.checked ? [...xs, m] : xs.filter((x) => x !== m)))} />
                <span><strong>{modifierLabels[m]}</strong><small>{modifierDescriptions[m]}</small></span>
              </label>
            ))}
            {mods.includes('limited_slots') && <label>Answer slots per question<input type="number" min={1} max={100} value={slotLimit} onChange={(e) => setSlotLimit(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label>}
            {split.no.length > 0 && (
              <details><summary>{split.no.length} modifier{split.no.length === 1 ? '' : 's'} not available for this setup</summary>
                <ul className="note">{split.no.map(({ m, reason }) => <li key={m}><strong>{modifierLabels[m]}</strong> — {reason}</li>)}</ul></details>
            )}
          </section>

          <section className="panel stack" aria-labelledby="s-go">
            <p className="eyebrow">Step 4</p><h2 id="s-go">Game Settings{mode === 'classroom' ? ' and Teams' : ''}</h2>
            <label>Match duration: {minutes} minutes<input type="range" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
            <label className="inline"><input type="checkbox" checked={noTimer} onChange={(e) => setNoTimer(e.target.checked)} /> No time limit per question</label>
            {!noTimer && <label>Time per question: {qSeconds} seconds<input type="range" min={5} max={300} step={5} value={qSeconds} onChange={(e) => setQSeconds(Number(e.target.value))} /></label>}
            {mode === 'classroom' && (
              <div className="stack">
                <div className="row spread"><h3 style={{ margin: 0 }}>Teams ({teams.length})</h3>
                  <div className="row">
                    <button className="btn small ghost" disabled={teams.length >= 8} onClick={() => setTeams((s) => [...s, `Team ${s.length + 1}`])}>Add team</button>
                    <button className="btn small ghost" disabled={teams.length <= 2} onClick={() => setTeams((s) => s.slice(0, -1))}>Remove team</button>
                  </div></div>
                <div className="grid2">{teams.map((n, i) => <label key={i}>Team {i + 1} name<input value={n} maxLength={40} onChange={(e) => setTeams((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} /></label>)}</div>
                <p className="note">In round robin, teams take turns in this order.</p>
              </div>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <div><button className="btn" onClick={launch} disabled={busy || needsAccount || questionCount === 0}>{busy ? 'Creating…' : 'Start Game'}</button></div>
          </section>
        </>
      )}
    </main>
  );
}
