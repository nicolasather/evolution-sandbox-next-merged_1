'use client';
/** Per-device display and sound preferences. Sound is OFF by default; motion follows the system setting unless the student turns it down further. */
import { useCallback, useEffect, useState } from 'react';
export type Prefs = { reduceMotion: boolean; lowFx: boolean; sound: boolean; contrast: boolean; large: boolean; hints: boolean };
const KEY = 'qz:cr:prefs'; const DEFAULT: Prefs = { reduceMotion: false, lowFx: false, sound: false, contrast: false, large: false, hints: true };
export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void, boolean] {
  const [p, setP] = useState<Prefs>(DEFAULT); const [sys, setSys] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); // eslint-disable-next-line react-hooks/set-state-in-effect -- read the stored preferences once on mount
      if (raw) setP({ ...DEFAULT, ...(JSON.parse(raw) as Partial<Prefs>) }); } catch { /* private mode: defaults */ }
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)'); if (!mq) return undefined;
    setSys(mq.matches); const f = () => setSys(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f);
  }, []);
  const set = useCallback((n: Partial<Prefs>) => setP((o) => { const v = { ...o, ...n }; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } return v; }), []);
  return [p, set, sys || p.reduceMotion];
}
/** A very small sound set made with the Web Audio API (no files). Silent unless the student turned sound on. */
export function beep(kind: 'hit' | 'good' | 'tick', on: boolean) {
  if (!on || typeof window === 'undefined') return;
  try { const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const a = new Ctx(); const o = a.createOscillator(); const g = a.createGain();
    o.frequency.value = kind === 'hit' ? 160 : kind === 'good' ? 660 : 440; o.type = 'square'; g.gain.value = 0.05; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.12); setTimeout(() => void a.close(), 300); } catch { /* no audio */ }
}
