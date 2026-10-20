'use client';
/** First-match tour: seven short, skippable steps that point at the real controls (path, points, question, build, upgrade, wave, result).
 *  It never blocks play: no backdrop, one "Skip" button, and it stays out of the way while a question is open. "Help" in the top bar brings it back. */
import { useEffect, useState } from 'react';

const KEY = 'qz:td:coach:v1';
type Step = { title: string; text: string; spot?: string };
export const STEPS: Step[] = [
  { title: 'The lane and the core', text: 'Enemies walk the winding lane from the gate to your core. Each one that gets through takes a bite out of the core’s health.', spot: '.td-board' },
  { title: 'Points', text: 'Correct answers earn points for your whole squad. Points are the only money in the game, and speed earns nothing.', spot: '.td-stat.points' },
  { title: 'Question time', text: 'Every round starts with a question. The battle is frozen while you answer, so read carefully. You see the explanation right after.' },
  { title: 'Build', text: 'Between waves, tap an empty pad (the squares with a +) and pick a tower. Point at a tower card to see on the map how much of the lane it reaches.', spot: '.td-rail' },
  { title: 'Upgrade', text: 'Tap a tower you built to upgrade it. At level 3 you choose one of two branches, each with a trade-off.', spot: '.td-rail' },
  { title: 'Wave', text: 'Press READY when your squad is set. The towers fire on their own and the wave plays out on every screen at once.', spot: '.td-readybox' },
  { title: 'Result', text: 'After each wave you see what got through. Keep the core alive until the last wave to win.' },
];

export function useCoach(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit flag lives in localStorage, readable only after hydration
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* storage off: show it once per load */ setOpen(true); } }, []);
  const close = () => { setOpen(false); try { localStorage.setItem(KEY, '1'); } catch { /* storage off */ } };
  return [open, () => setOpen(true), close];
}

export default function Coach({ onClose, hidden }: { onClose: () => void; hidden?: boolean }) {
  const [i, setI] = useState(0); const step = STEPS[i]!;
  useEffect(() => {
    if (hidden || !step.spot) return;
    const el = document.querySelector(step.spot); el?.classList.add('td-spot');
    return () => { el?.classList.remove('td-spot'); };
  }, [i, hidden, step.spot]);
  if (hidden) return null;
  return (
    <aside className="td-coach" role="region" aria-label="How to play" data-testid="td-coach">
      <h2><span className="steps" aria-hidden="true">{STEPS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</span>{step.title}</h2>
      <p>{step.text}</p>
      <div className="td-row">
        <button type="button" className="td-btn ghost small" onClick={onClose}>Skip tour</button>
        {i > 0 && <button type="button" className="td-btn small" onClick={() => setI(i - 1)}>Back</button>}
        {i < STEPS.length - 1 ? <button type="button" className="td-btn primary small" onClick={() => setI(i + 1)}>Next ({i + 1}/{STEPS.length})</button> : <button type="button" className="td-btn primary small" onClick={onClose}>Got it</button>}
      </div>
    </aside>
  );
}
