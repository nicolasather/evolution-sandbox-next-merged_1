'use client';
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GameStage, { usePrefs } from './GameStage';
import TutorialOverlay from './TutorialOverlay';
import { tr } from './i18n';
import { useLocalGame } from './useGame';
import { MODE_LIST, MODES, isGameKey } from '@/lib/quiz/projector/modes';
import { DURATION_PRESETS } from '@/lib/quiz/projector/scale';
import type { GameKey, LearningFocus } from '@/lib/quiz/projector/types';

const NAMES = ['Red', 'Blue', 'Green', 'Gold', 'Violet', 'Teal', 'Pink', 'Grey'];
function Run({ game, teams, minutes, focus }: { game: GameKey; teams: number; minutes: number | null; focus: LearningFocus }) {
  const [prefs, setPrefs] = usePrefs('en');
  const teamNames = useMemo(() => NAMES.slice(0, teams), [teams]);
  const api = useLocalGame({ game, teamNames, minutes, focus, seed: 'lab-' + game }, prefs.locale);
  return <GameStage api={api} view="host" prefs={prefs} setPrefs={setPrefs} />;
}
/** Teams / Time / Focus / How to play for the practice lab. Changing any of them restarts the sample game. */
function LabBar({ game, teams, minutes, focus }: { game: GameKey; teams: number; minutes: number | null; focus: LearningFocus }) {
  const router = useRouter();
  const go = (p: { teams?: number; minutes?: number | null; focus?: LearningFocus; game?: GameKey }) => {
    const t = p.teams ?? teams, m = p.minutes === undefined ? minutes : p.minutes, f = p.focus ?? focus, g = p.game ?? game;
    router.replace(`/quiz/lab?game=${g}&teams=${t}&minutes=${m === null ? 'none' : m}&focus=${f}`);
  };
  return (
    <div className="pj-labbar" role="group" aria-label="Practice lab settings">
      <Link className="btn small ghost" href="/quiz/lab">All games</Link>
      <label>Game <select aria-label="Game" value={game} onChange={(e) => go({ game: e.target.value as GameKey })}>{MODE_LIST.map((m) => <option key={m.key} value={m.key}>{m.name.en}</option>)}</select></label>
      <label>Teams <select aria-label="Teams" value={teams} onChange={(e) => go({ teams: Number(e.target.value) })}>{[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label>Time <select aria-label="Time" value={minutes ?? 'none'} onChange={(e) => go({ minutes: e.target.value === 'none' ? null : Number(e.target.value) })}>{DURATION_PRESETS.map((n) => <option key={n} value={n}>{n} min</option>)}<option value="none">No clock</option></select></label>
      <label>Focus <select aria-label="Focus" value={focus} onChange={(e) => go({ focus: e.target.value as LearningFocus })}><option value="balanced">Balanced</option><option value="study">Study</option><option value="game">Game</option></select></label>
      <TutorialOverlay game={game} name={MODES[game].name.en} auto={false} />
      <span className="pj-labnote">Sample questions · nothing is saved and no rewards are given</span>
    </div>
  );
}
/** Practice Lab: the real game engine with sample questions, in the browser. No account, no database. */
export default function LabGame() {
  const q = useSearchParams(); const g = q.get('game');
  const [prefs] = usePrefs('en');
  if (isGameKey(g)) {
    const m = q.get('minutes'); const minutes = m === 'none' ? null : Math.max(5, Math.min(180, Number(m) || MODES[g].defaultMinutes));
    const teams = Math.max(2, Math.min(8, Number(q.get('teams')) || 3)); const f = q.get('focus'); const focus: LearningFocus = f === 'study' || f === 'game' ? f : 'balanced';
    return <><LabBar game={g} teams={teams} minutes={minutes} focus={focus} /><Run key={`${g}-${teams}-${minutes}-${focus}`} game={g} teams={teams} minutes={minutes} focus={focus} /></>;
  }
  return (
    <main className="page stack">
      <p className="eyebrow">Practice Lab</p><h1>{tr(prefs.locale, 'chooseGame')}</h1>
      <p className="muted-text">All ten projector games with sample questions. Pick teams, time and focus once you are inside. Nothing is saved.</p>
      <div className="pj-games">{MODE_LIST.map((m) => (
        <div key={m.key} className="pj-game" style={{ ['--accent' as string]: m.accent }}>
          <Link href={`/quiz/lab?game=${m.key}`} className="pj-gamelink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/quiz/modes/${m.art}.svg`} alt="" /><span className="body"><span className="tag">{m.style.en}</span><h3>{m.name.en}</h3><p>{m.tagline.en}</p></span>
          </Link>
          <div className="pj-gamefoot"><Link className="btn small primary" href={`/quiz/lab?game=${m.key}`}>Play in lab</Link><TutorialOverlay game={m.key} name={m.name.en} auto={false} /></div>
        </div>))}</div>
    </main>
  );
}
