import type { SoundId } from './types';

/* ============================================================================
   AUDIO — material sounds, synthesised. No files, no downloads: a handful of
   oscillators and filtered noise bursts, each a few tens of milliseconds, so
   a stone sounds like a stone and a hearth like a hearth. Quiet by design.

   The AudioContext is created on the first user gesture (browsers require it)
   and everything is a no-op until then, in tests, and when sound is off.
   ========================================================================== */

const KEY = 'evo.craft.sound';
const VOL_KEY = 'evo.craft.volume';
const EVENT = 'evo:craft-sound';
/** The master gain at full volume: everything is quiet by design. */
const MASTER_GAIN = 0.34;

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
/** 0–1, what the player set with the volume control (1 = the designed level). */
export function getVolume(): number {
  try {
    const v = window.localStorage.getItem(VOL_KEY);
    if (v === null) return 1;
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  } catch { return 1; }
}
export function setVolume(v: number) {
  const n = Math.max(0, Math.min(1, v));
  try { window.localStorage.setItem(VOL_KEY, String(n)); } catch { /* storage blocked */ }
  if (ctx && master) master.gain.setTargetAtTime(MASTER_GAIN * n, ctx.currentTime, 0.03);
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
      master.gain.value = MASTER_GAIN * getVolume();
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
  if (wantAmbience) applyAmbience();
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

const MIN_GAP: Partial<Record<SoundId, number>> = { scrape: 70, rustle: 90, crackle: 80, hiss: 180, hum: 120, splash: 60, plip: 55, puff: 140 };

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
    case 'plip':
      // a drop breaking the surface: a short rising sine, a wet hiss of noise, and a
      // little after-drop. `rate` varies the pitch so no two clicks sound the same.
      tone(dest, 520 * r, 1500 * r, 0.09, 'sine', 0.34 * v);
      burst(dest, 'bandpass', 1800 * r, 900 * r, 1.1, 0.14, 0.2 * v);
      tone(dest, 760 * r, 1900 * r, 0.06, 'sine', 0.16 * v, 0.07 + Math.random() * 0.05);
      break;
    case 'puff':
      // dust or a brush of grass: air through a soft low-pass
      burst(dest, 'lowpass', 900 * r, 260 * r, 0.5, 0.2, 0.26 * v);
      burst(dest, 'bandpass', 2600 * r, 1500 * r, 0.7, 0.1, 0.07 * v);
      break;
  }
}


/* ============================================================================
   CUES — the interface's own sounds (as opposed to material sounds above):
   hover, select, tab, archive, graph, combine, discovery, major, hidden, era
   and the intro. Same rules: synthesised, quiet, a no-op until a gesture has
   unlocked audio and whenever sound is off. Everything else in the app goes
   through lib/sound.ts, never straight to this file.
   ========================================================================== */

export type CueId =
  | 'hover' | 'select' | 'tab' | 'archive' | 'graph' | 'combine'
  | 'discovery' | 'major' | 'hidden' | 'era' | 'begin' | 'flash' | 'stone' | 'refuse';

/** A slow tone with a gentle attack — for swells and pads (tone() is percussive). */
function swell(dest: AudioNode, f0: number, f1: number, dur: number, type: OscillatorType, vol: number, atk = 0.3, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(atk, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

const CUE_GAP: Partial<Record<CueId, number>> = { hover: 140, select: 40, tab: 60, graph: 90 };

export function cue(id: CueId, o: { vol?: number } = {}) {
  if (!ctx || !master || !soundEnabled()) return;
  const now = performance.now();
  const key = `cue:${id}`;
  if (now - (last.get(key) ?? -1e9) < (CUE_GAP[id] ?? 30)) return;
  last.set(key, now);
  const dest = master;
  const v = Math.max(0.02, Math.min(1.2, o.vol ?? 1));
  switch (id) {
    case 'hover':
      tone(dest, 1500, 1420, 0.03, 'sine', 0.045 * v);
      break;
    case 'select':
      tone(dest, 1100, 760, 0.06, 'triangle', 0.13 * v);
      break;
    case 'tab':
      tone(dest, 740, 720, 0.09, 'sine', 0.1 * v);
      burst(dest, 'highpass', 5200, 5200, 0.7, 0.02, 0.06 * v);
      break;
    case 'archive': // a drawer of paper sliding open
      burst(dest, 'lowpass', 1100, 320, 0.6, 0.22, 0.12 * v);
      tone(dest, 196, 170, 0.28, 'sine', 0.08 * v);
      break;
    case 'graph': // a line closing between two points
      tone(dest, 1320, 1760, 0.16, 'sine', 0.07 * v);
      tone(dest, 1980, 1980, 0.22, 'sine', 0.035 * v, 0.05);
      break;
    case 'combine': // the tactile moment of impact
      tone(dest, 190, 86, 0.1, 'sine', 0.38 * v);
      burst(dest, 'lowpass', 900, 400, 0.7, 0.05, 0.16 * v);
      break;
    case 'discovery': // a soft harmonic: three partials, staggered
      [392, 494, 587, 784].forEach((f, i) => swell(dest, f, f, 1.5, 'sine', 0.085 * v, 0.02, i * 0.07));
      tone(dest, 98, 98, 0.9, 'sine', 0.1 * v);
      break;
    case 'major': // deeper, layered, slower
      swell(dest, 55, 62, 2.6, 'sine', 0.3 * v, 0.35);
      [147, 220, 294, 440, 588].forEach((f, i) => swell(dest, f, f * 1.003, 2.4, 'sine', 0.075 * v, 0.05, 0.12 + i * 0.11));
      burst(dest, 'bandpass', 400, 2400, 0.7, 1.4, 0.05 * v, 0.1);
      tone(dest, 1760, 1760, 1.4, 'sine', 0.025 * v, 0.5);
      break;
    case 'hidden': // something the player was not meant to see: two close, uneasy tones
      swell(dest, 233, 233, 2.2, 'sine', 0.09 * v, 0.7);
      swell(dest, 239, 239, 2.2, 'sine', 0.09 * v, 0.7);
      tone(dest, 1568, 1568, 1.1, 'sine', 0.03 * v, 0.9);
      break;
    case 'era': // long, atmospheric
      swell(dest, 82, 164, 2.8, 'sine', 0.22 * v, 0.8);
      swell(dest, 123, 246, 2.8, 'triangle', 0.06 * v, 1.0);
      burst(dest, 'lowpass', 260, 1300, 0.6, 2.4, 0.06 * v);
      break;
    case 'begin':
      swell(dest, 96, 128, 0.9, 'sine', 0.2 * v, 0.2);
      break;
    case 'flash':
      burst(dest, 'highpass', 3200, 6000, 0.6, 0.3, 0.2 * v);
      tone(dest, 62, 40, 0.5, 'sine', 0.5 * v);
      break;
    case 'stone':
      tone(dest, 132, 68, 0.36, 'sine', 0.5 * v);
      burst(dest, 'lowpass', 700, 260, 0.6, 0.09, 0.25 * v);
      break;
    case 'refuse':
      tone(dest, 210, 150, 0.09, 'triangle', 0.14 * v);
      break;
  }
}

/** The rising rush of the time tunnel. Returns a function that fades it out. */
export function tunnelRise(seconds: number): () => void {
  if (!ctx || !master || !noise || !soundEnabled()) return () => {};
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(180, t);
  f.frequency.exponentialRampToValueAtTime(3600, t + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.13, t + seconds * 0.85);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(48, t);
  o.frequency.exponentialRampToValueAtTime(190, t + seconds);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.linearRampToValueAtTime(0.08, t + seconds * 0.9);
  src.connect(f); f.connect(g); g.connect(master);
  o.connect(og); og.connect(master);
  src.start(t); o.start(t);
  let stopped = false;
  return () => {
    if (stopped || !ctx) return;
    stopped = true;
    const n = ctx.currentTime;
    g.gain.cancelScheduledValues(n); og.gain.cancelScheduledValues(n);
    g.gain.setValueAtTime(g.gain.value, n); og.gain.setValueAtTime(og.gain.value, n);
    g.gain.exponentialRampToValueAtTime(0.0001, n + 0.18);
    og.gain.exponentialRampToValueAtTime(0.0001, n + 0.18);
    src.stop(n + 0.22); o.stop(n + 0.22);
  };
}


/* ============================================================================
   AMBIENCE — a very quiet bed under everything, one per stretch of history.
   Wind on the plains, a hearth's low crackle, a market's murmur, a forge's
   pulse, machine rumble, mains hum, a faint digital shimmer. Built from the
   same noise buffer and a few oscillators; crossfaded, never abrupt; silent
   whenever sound is off, and it follows the volume control through the master.
   ========================================================================== */

export type Ambience = 'wind' | 'hearth' | 'murmur' | 'forge' | 'machine' | 'hum' | 'digital';

interface Bed { kind: Ambience; gain: GainNode; stop: (at: number) => void }
let bed: Bed | null = null;
let wantAmbience: Ambience | null = null;
/** Level of every bed (they are all far below the effects). */
const BED_LEVEL = 0.5;

function buildBed(kind: Ambience): Bed | null {
  if (!ctx || !master || !noise) return null;
  const c = ctx;
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  gain.connect(master);
  const srcs: (AudioScheduledSourceNode)[] = [];
  const nodes: AudioNode[] = [gain];
  const src = (): AudioBufferSourceNode => { const b = c.createBufferSource(); b.buffer = noise; b.loop = true; srcs.push(b); return b; };
  const lfo = (freq: number, depth: number, target: AudioParam) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = c.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(target); srcs.push(o); nodes.push(g);
  };
  const filt = (type: BiquadFilterType, f: number, q: number) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; nodes.push(b); return b; };
  const amp = (v: number) => { const g = c.createGain(); g.gain.value = v; nodes.push(g); return g; };
  const osc = (type: OscillatorType, f: number) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; srcs.push(o); return o; };

  switch (kind) {
    case 'wind': {            // air over open ground, slowly gusting
      const n = src(), f = filt('bandpass', 420, 0.6), a = amp(0.55);
      lfo(0.07, 260, f.frequency); lfo(0.11, 0.25, a.gain);
      n.connect(f); f.connect(a); a.connect(gain);
      break;
    }
    case 'hearth': {          // a low fire: dull roar, and flickering
      const n = src(), f = filt('lowpass', 520, 0.7), a = amp(0.5);
      lfo(0.9, 0.18, a.gain); lfo(0.23, 120, f.frequency);
      n.connect(f); f.connect(a); a.connect(gain);
      const n2 = src(), h = filt('highpass', 3800, 0.6), a2 = amp(0.05);
      lfo(3.1, 0.05, a2.gain);
      n2.connect(h); h.connect(a2); a2.connect(gain);
      break;
    }
    case 'murmur': {          // far-off voices: noise in the vowel band, breathing
      const n = src(), f = filt('bandpass', 620, 1.4), a = amp(0.4);
      lfo(0.31, 0.22, a.gain); lfo(0.13, 180, f.frequency);
      n.connect(f); f.connect(a); a.connect(gain);
      break;
    }
    case 'forge': {           // a bellows' pulse over a low glow
      const n = src(), f = filt('lowpass', 380, 0.9), a = amp(0.55);
      lfo(0.42, 0.3, a.gain);
      n.connect(f); f.connect(a); a.connect(gain);
      const o = osc('sine', 55), og = amp(0.35);
      lfo(0.42, 0.2, og.gain);
      o.connect(og); og.connect(gain);
      break;
    }
    case 'machine': {         // engines somewhere below the floor
      const o = osc('sawtooth', 44), f = filt('lowpass', 150, 0.8), a = amp(0.32);
      lfo(6.3, 0.06, a.gain);
      o.connect(f); f.connect(a); a.connect(gain);
      const n = src(), nf = filt('lowpass', 300, 0.5), na = amp(0.3);
      n.connect(nf); nf.connect(na); na.connect(gain);
      break;
    }
    case 'hum': {             // mains: 50 Hz and its second harmonic, a little unsteady
      const o1 = osc('sine', 50), o2 = osc('sine', 100), a1 = amp(0.28), a2 = amp(0.1);
      lfo(0.2, 0.03, a1.gain);
      o1.connect(a1); a1.connect(gain); o2.connect(a2); a2.connect(gain);
      const n = src(), nf = filt('highpass', 5200, 0.5), na = amp(0.012);
      n.connect(nf); nf.connect(na); na.connect(gain);
      break;
    }
    case 'digital': {         // a faint shimmer of very high partials, drifting
      const fs = [1320, 1760, 2349], os = fs.map(f => osc('sine', f));
      os.forEach((o, i) => { const a = amp(0.025); lfo(0.09 + i * 0.05, 0.02, a.gain); lfo(0.05 + i * 0.03, 8 + i * 5, o.frequency); o.connect(a); a.connect(gain); });
      const o = osc('sine', 62), a = amp(0.16);
      o.connect(a); a.connect(gain);
      break;
    }
  }
  const t = c.currentTime;
  srcs.forEach(sr => { try { if (sr instanceof AudioBufferSourceNode) sr.start(t, Math.random() * 0.4); else sr.start(t); } catch { /* already started */ } });
  return {
    kind, gain,
    stop(at: number) {
      srcs.forEach(sr => { try { sr.stop(at); } catch { /* not running */ } });
      window.setTimeout(() => { nodes.forEach(nd => { try { nd.disconnect(); } catch { /* gone */ } }); }, Math.max(0, (at - c.currentTime) * 1000) + 60);
    },
  };
}

function applyAmbience() {
  if (!ctx || !master) return;
  const c = ctx, want = soundEnabled() ? wantAmbience : null;
  if (bed && bed.kind === want) { bed.gain.gain.setTargetAtTime(BED_LEVEL, c.currentTime, 0.4); return; }
  if (bed) {                                   // fade the old one out, and let it go
    const old = bed; bed = null;
    old.gain.gain.cancelScheduledValues(c.currentTime);
    old.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
    old.stop(c.currentTime + 2.6);
  }
  if (!want) return;
  const nb = buildBed(want);
  if (!nb) return;
  bed = nb;
  nb.gain.gain.setValueAtTime(0.0001, c.currentTime);
  nb.gain.gain.setTargetAtTime(BED_LEVEL, c.currentTime, 0.9);
}

/** Ask for a bed (or none). Safe to call at any time: it starts as soon as audio is unlocked and sound is on. */
export function setAmbience(kind: Ambience | null) {
  wantAmbience = kind;
  if (typeof window === 'undefined') return;
  applyAmbience();
}

/** The bed that belongs to an era. */
export function ambienceForEra(era: string): Ambience {
  switch (era) {
    case 'origins': case 'agriculture': return 'wind';
    case 'fire': case 'settlement': return 'hearth';
    case 'civilization': case 'trade': return 'murmur';
    case 'metallurgy': case 'science': return 'forge';
    case 'industry': return 'machine';
    case 'electric': return 'hum';
    default: return 'digital';               // computing, network, games, simulation
  }
}

// the bed follows the sound switch
if (typeof window !== 'undefined') window.addEventListener(EVENT, () => applyAmbience());
