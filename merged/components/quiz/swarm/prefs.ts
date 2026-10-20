'use client';
import { useCallback, useEffect, useState } from 'react';
/** Local-only display settings (never sent to the server, never part of any score). */
export type Prefs = { reduced: boolean; contrast: boolean; names: boolean; sound: boolean; large: boolean };
const KEY = 'swarm:prefs';
const defaults = (): Prefs => ({ reduced: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, contrast: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-contrast: more)').matches, names: true, sound: false, large: false });
export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [p, set] = useState<Prefs>({ reduced: false, contrast: false, names: true, sound: false, large: false });
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { let saved: Partial<Prefs> = {}; try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>; } catch { /* private mode */ } set({ ...defaults(), ...saved }); }, []);
  const update = useCallback((n: Partial<Prefs>) => set((cur) => { const next = { ...cur, ...n }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ } return next; }), []);
  return [p, update];
}
/** Short synthesized cues (no audio files). Off by default; only plays after the student turned it on. */
let ac: AudioContext | null = null;
export function cue(kind: 'good' | 'bad' | 'down' | 'wave', on: boolean) {
  if (!on || typeof window === 'undefined') return; try {
    ac ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); const t = ac.currentTime; const o = ac.createOscillator(); const g = ac.createGain();
    const f = kind === 'good' ? [523, 784] : kind === 'bad' ? [220, 196] : kind === 'down' ? [165, 110] : [392, 523]; o.type = 'triangle'; o.frequency.setValueAtTime(f[0]!, t); o.frequency.setValueAtTime(f[1]!, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.26);
  } catch { /* audio blocked */ }
}
