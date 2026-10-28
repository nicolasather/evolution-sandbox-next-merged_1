/**
 * Zero-asset arcade sound effects, synthesised with the Web Audio API. No MP3s, no network, instant load.
 * Every call is a no-op on the server, when muted, or when the browser refuses an AudioContext.
 */
const MUTE_KEY = 'evo.quiz.muted';
let ctx: AudioContext | null = null;
let muted = false;
let mutedLoaded = false;

function loadMuted() {
  if (mutedLoaded || typeof window === 'undefined') return;
  mutedLoaded = true;
  try { muted = window.localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked */ }
}
export function isMuted(): boolean { loadMuted(); return muted; }
export function setMuted(v: boolean) {
  loadMuted(); muted = v;
  try { window.localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
}
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

type Tone = { type: OscillatorType; from: number; to?: number; start: number; dur: number; gain?: number };
function play(tones: Tone[]) {
  loadMuted();
  if (muted) return;
  const a = audio(); if (!a) return;
  const t0 = a.currentTime;
  for (const t of tones) {
    const osc = a.createOscillator(); const g = a.createGain();
    osc.type = t.type;
    osc.frequency.setValueAtTime(t.from, t0 + t.start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.start + t.dur);
    const peak = t.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, t0 + t.start);
    g.gain.exponentialRampToValueAtTime(peak, t0 + t.start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.start + t.dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0 + t.start); osc.stop(t0 + t.start + t.dur + 0.02);
  }
}

/** C-major ascending arpeggio, triangle wave, 0.35 s in total. */
export const CORRECT_NOTES = [523.25, 659.25, 783.99, 1046.5] as const;
export function playCorrect() {
  const step = 0.35 / CORRECT_NOTES.length;
  play(CORRECT_NOTES.map((f, i) => ({ type: 'triangle' as const, from: f, start: i * step, dur: step * 1.1 })));
}
/** Descending sawtooth glide 180 -> 95 Hz over 0.30 s. */
export function playWrong() { play([{ type: 'sawtooth', from: 180, to: 95, start: 0, dur: 0.3, gain: 0.14 }]); }
/** Electronic sweep 880 -> 220 Hz, square wave, when a Streak Shield absorbs a hit. */
export function playShield() { play([{ type: 'square', from: 880, to: 220, start: 0, dur: 0.35, gain: 0.1 }]); }
/** Crisp 1200 Hz pulse, 0.04 s, for each of the final five seconds. */
export function playTick() { play([{ type: 'square', from: 1200, start: 0, dur: 0.04, gain: 0.08 }]); }
