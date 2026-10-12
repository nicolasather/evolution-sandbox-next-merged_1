'use client';
import { useEffect, useRef, useState } from 'react';

export const QUOTE = 'A settlement is more than the things it builds. It is the connections that keep them working.';

/** Title -> subtitle -> quote. ~8s the first time, ~2s afterwards. Always skippable (button, Space, Enter, Escape). */
/** The app's shared mode gate (components/cinematic/CinematicGate) can sit above a freshly mounted mode; wait for it. */
const gateOpen = (): boolean => typeof document !== 'undefined' && !!document.querySelector('.cg[role="dialog"]');

export function EntryCinematic({ first, reduced, onDone }: { first: boolean; reduced: boolean; onDone: () => void }) {
  const done = useRef(false);
  const [waiting, setWaiting] = useState(gateOpen);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  useEffect(() => {
    if (!waiting) return undefined;
    const obs = new MutationObserver(() => { if (!gateOpen()) setWaiting(false); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [waiting]);
  useEffect(() => {
    if (waiting) return undefined;
    const ms = reduced ? (first ? 3000 : 1200) : first ? 8000 : 2000;
    const t = window.setTimeout(finish, ms);
    const key = (e: KeyboardEvent) => { if (['Escape', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); finish(); } };
    window.addEventListener('keydown', key);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);
  if (waiting) return <div className="ll-cine" aria-hidden="true" />;
  return (
    <div className={'ll-cine' + (first ? ' first' : ' short') + (reduced ? ' still' : '')} role="status" aria-label="Civilization: Lifelines">
      <div className="ll-cine-grid" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
      <h1 className="ll-cine-title">Civilization</h1>
      <p className="ll-cine-sub">Lifelines</p>
      {first && <p className="ll-cine-quote">{QUOTE}</p>}
      <button type="button" className="ll-btn ghost ll-cine-skip" onClick={finish} autoFocus>Skip</button>
    </div>
  );
}
