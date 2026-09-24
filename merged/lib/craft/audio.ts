import type { SoundId } from './types';

/* ============================================================================
   AUDIO — material sounds, synthesised. No files, no downloads: a handful of
   oscillators and filtered noise bursts, each a few tens of milliseconds, so
   a stone sounds like a stone and a hearth like a hearth. Quiet by design.

   The AudioContext is created on the first user gesture (browsers require it)
   and everything is a no-op until then, in tests, and when sound is off.
   ========================================================================== */

const KEY = 'evo.craft.sound';
const EVENT = 'evo:craft-sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const last = new Map<string, number>();

export function soundEnabled(): boolean {
  try { return window.localStorage.getItem(KEY) !== '0'; } catch { return true; }
}
export function setSoundEnabled(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}
export function subscribeSound(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Call from a pointer or key handler: browsers only allow audio after a gesture. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.34;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      const n = Math.floor(ctx.sampleRate * 0.5);
      noise = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; return; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

interface Opts { vol?: number; rate?: number; pan?: number }

function out(pan: number): AudioNode | null {
  if (!ctx || !master) return null;
  if (!pan) return master;
  const p = ctx.createStereoPanner?.();
  if (!p) return master;
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(master);
  return p;
}

function tone(dest: AudioNode, f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.006, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function burst(dest: AudioNode, kind: BiquadFilterType, f0: number, f1: number, q: number, dur: number, vol: number, delay = 0) {
  if (!ctx || !noise) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.008, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}

const MIN_GAP: Partial<Record<SoundId, number>> = { scrape: 70, rustle: 90, crackle: 80, hiss: 180, hum: 120, splash: 60 };

export function play(id: SoundId, o: Opts = {}) {
  if (!ctx || !master || !soundEnabled()) return;
  const now = performance.now();
  const gap = MIN_GAP[id] ?? 25;
  if (now - (last.get(id) ?? -1e9) < gap) return;
  last.set(id, now);
  const dest = out(o.pan ?? 0);
  if (!dest) return;
  const v = Math.max(0.02, Math.min(1.2, o.vol ?? 1));
  const r = o.rate ?? 1;
  switch (id) {
    case 'clack':
      burst(dest, 'bandpass', 2400 * r, 1800 * r, 2.2, 0.05, 0.5 * v);
      tone(dest, 980 * r, 420 * r, 0.07, 'sine', 0.32 * v);
      break;
    case 'knock':
      tone(dest, 230 * r, 120 * r, 0.11, 'triangle', 0.55 * v);
      burst(dest, 'lowpass', 1100, 500, 0.7, 0.04, 0.3 * v);
      break;
    case 'click':
      tone(dest, 2100 * r, 1300 * r, 0.035, 'sine', 0.35 * v);
      burst(dest, 'highpass', 4200, 4200, 0.7, 0.02, 0.22 * v);
      break;
    case 'rustle':
      burst(dest, 'bandpass', 3400 * r, 2200 * r, 0.8, 0.13, 0.22 * v);
      break;
    case 'ring':
      burst(dest, 'highpass', 3000, 3000, 0.7, 0.02, 0.3 * v);
      tone(dest, 640 * r, 620 * r, 0.6, 'sine', 0.22 * v);
      tone(dest, 1710 * r, 1690 * r, 0.42, 'sine', 0.1 * v);
      break;
    case 'splash':
      burst(dest, 'lowpass', 2200, 500, 0.6, 0.22, 0.34 * v);
      break;
    case 'hiss':
      burst(dest, 'highpass', 4800, 5200, 0.5, 0.38, 0.22 * v);
      break;
    case 'thud':
      tone(dest, 96 * r, 48 * r, 0.16, 'sine', 0.7 * v);
      burst(dest, 'lowpass', 420, 220, 0.6, 0.05, 0.3 * v);
      break;
    case 'chime':
      tone(dest, 880 * r, 880 * r, 0.7, 'sine', 0.2 * v);
      tone(dest, 1320 * r, 1320 * r, 0.6, 'sine', 0.12 * v, 0.04);
      tone(dest, 1760 * r, 1760 * r, 0.5, 'sine', 0.06 * v, 0.09);
      break;
    case 'snap':
      tone(dest, 1500 * r, 900 * r, 0.03, 'triangle', 0.35 * v);
      burst(dest, 'highpass', 3600, 3600, 0.7, 0.02, 0.2 * v);
      break;
    case 'tick':
      tone(dest, 1900 * r, 1700 * r, 0.025, 'triangle', 0.25 * v);
      break;
    case 'whoosh':
      burst(dest, 'bandpass', 500 * r, 2000 * r, 0.9, 0.2, 0.22 * v);
      break;
    case 'crackle':
      for (let i = 0; i < 3; i++) burst(dest, 'highpass', 2500 + Math.random() * 3000, 3000, 0.6, 0.012, 0.22 * v, i * 0.03 + Math.random() * 0.02);
      break;
    case 'hum':
      tone(dest, 110 * r, 118 * r, 0.22, 'sawtooth', 0.06 * v);
      tone(dest, 220 * r, 228 * r, 0.22, 'sine', 0.05 * v);
      break;
    case 'scrape':
      burst(dest, 'bandpass', 1500 * r, 1300 * r, 3, 0.09, 0.22 * v);
      break;
    case 'pop':
      tone(dest, 420 * r, 900 * r, 0.04, 'sine', 0.3 * v);
      break;
  }
}
