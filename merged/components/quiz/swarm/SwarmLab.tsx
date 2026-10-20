'use client';
/** Practice: play alone against the real game rules, in your browser. No account, no server, nothing saved, no points that count for anything. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SwarmGame from './SwarmGame';
import { useSwarm } from './useSwarm';
import { usePrefs } from './prefs';
import { PracticeSession } from '@/lib/swarm/client/loopback';
import { MAP_IDS, type MapId } from '@/lib/swarm/domain';

const MAP_LABEL: Record<MapId, string> = { meadow_circuit: 'Meadow Circuit', paper_quarry: 'Paper Quarry', frost_conservatory: 'Frost Conservatory' };
function Run({ opts, onAgain }: { opts: { name: string; minutes: number; difficulty: 'easy' | 'normal' | 'challenge'; mapId: MapId; lowPressure: boolean }; onAgain: () => void }) {
  const [prefs, setPrefs] = usePrefs(); const [session, setSession] = useState<PracticeSession | null>(null);
  // created inside the effect so React's dev double-mount closes one session and builds a fresh one
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const s = new PracticeSession(opts); setSession(s); return () => { s.close(); setSession(null); }; }, [opts]);
  const copts = useMemo(() => (session ? { wsUrl: 'practice://local', token: 'practice', WebSocketImpl: session.socketClass() } : null), [session]);
  const { conn } = useSwarm(copts, session ? 'practice' : 'none');
  if (!conn || !session) return <main className="sw" id="main"><section className="sw-card" role="status"><h2>Starting practice…</h2></section></main>;
  return <SwarmGame conn={conn} prefs={prefs} setPrefs={setPrefs} practice={{ start: () => session.begin(), again: onAgain }} />;
}
export default function SwarmLab() {
  const [name, setName] = useState('You'); const [minutes, setMinutes] = useState(5); const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'challenge'>('easy'); const [mapId, setMapId] = useState<MapId>('meadow_circuit'); const [low, setLow] = useState(false);
  const [run, setRun] = useState<{ name: string; minutes: number; difficulty: 'easy' | 'normal' | 'challenge'; mapId: MapId; lowPressure: boolean } | null>(null);
  if (run) return <Run opts={run} onAgain={() => setRun(null)} />;
  return (
    <main className="sw narrow" id="main">
      <form className="sw-card" onSubmit={(e) => { e.preventDefault(); setRun({ name: name.trim() || 'You', minutes, difficulty, mapId, lowPressure: low }); }}>
        <h1>Practice Swarm Survival</h1>
        <p>Try the real thing alone: move, fight, answer questions between waves and spend points on upgrades. It runs in your browser. Nothing is saved and nobody sees it.</p>
        <label className="sw-field">Your name<input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label>
        <label className="sw-field">Length<select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></label>
        <label className="sw-field">Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="challenge">Challenge</option></select></label>
        <label className="sw-field">Map<select value={mapId} onChange={(e) => setMapId(e.target.value as MapId)}>{MAP_IDS.map((m) => <option key={m} value={m}>{MAP_LABEL[m]}</option>)}</select></label>
        <label className="sw-check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Low pressure (longer warnings, gentler hits)</label>
        <button className="sw-btn primary big" type="submit" data-testid="practice-go">Start practice</button>
        <p className="sw-note">Playing with a class? <Link href="/quiz/swarm/join">Join with a code</Link>.</p>
      </form>
    </main>
  );
}
