'use client';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GameStage, { usePrefs } from './GameStage';
import { detectLocale, tr } from './i18n';
import { useLocalGame } from './useGame';
import { MODE_LIST, MODES, isGameKey } from '@/lib/quiz/projector/modes';
import { L } from './i18n';
import type { GameKey, LearningFocus } from '@/lib/quiz/projector/types';

const NAMES = ['Red', 'Blue', 'Green', 'Gold', 'Violet', 'Teal', 'Pink', 'Grey'];
function Run({ game, teams, minutes, focus }: { game: GameKey; teams: number; minutes: number | null; focus: LearningFocus }) {
  const [prefs, setPrefs] = usePrefs('en');
  useEffect(() => { try { if (!localStorage.getItem('qz:pj:prefs')) setPrefs({ locale: detectLocale() }); } catch { /* ignore */ } }, [setPrefs]);
  const teamNames = useMemo(() => NAMES.slice(0, teams), [teams]);
  const api = useLocalGame({ game, teamNames, minutes, focus, seed: 'lab-' + game }, prefs.locale);
  return <GameStage api={api} view="host" prefs={prefs} setPrefs={setPrefs} />;
}
/** Practice Lab: the real game engine with sample questions, in the browser. No account, no database. */
export default function LabGame() {
  const q = useSearchParams(); const g = q.get('game');
  const [prefs] = usePrefs('en');
  if (isGameKey(g)) {
    const m = q.get('minutes'); const minutes = m === 'none' ? null : Math.max(5, Math.min(180, Number(m) || MODES[g].defaultMinutes));
    const teams = Math.max(2, Math.min(8, Number(q.get('teams')) || 3)); const f = q.get('focus');
    return <Run key={`${g}-${teams}-${minutes}`} game={g} teams={teams} minutes={minutes} focus={f === 'study' || f === 'game' ? f : 'balanced'} />;
  }
  return (
    <main className="page stack">
      <p className="eyebrow">Practice Lab</p><h1>{tr(prefs.locale, 'chooseGame')}</h1>
      <div className="pj-games">{MODE_LIST.map((m) => (
        <Link key={m.key} className="pj-game" style={{ ['--accent' as string]: m.accent }} href={`/quiz/lab?game=${m.key}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/quiz/modes/${m.art}.svg`} alt="" /><span className="body"><span className="tag">{L(prefs.locale, m.style)}</span><h3>{L(prefs.locale, m.name)}</h3><p>{L(prefs.locale, m.tagline)}</p></span>
        </Link>))}</div>
    </main>
  );
}
