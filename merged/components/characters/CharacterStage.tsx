'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useHasMounted } from '@/lib/useHasMounted';
import { CharacterRig } from './CharacterRig';
import { CharacterDisclosure, CharacterSettings } from './CharacterSettings';
import { CharacterPrankTag, CharacterSpeechBubble } from './CharacterSpeechBubble';
import { CharacterUnlockCeremony } from './CharacterUnlockCeremony';
import { actionRegistry } from '@/lib/characters/actions';
import { playClip, type Playing } from '@/lib/characters/animator';
import { attachRetentionBridge } from '@/lib/characters/bridge';
import { characterBus, emitCrew, provideCrewContext, setCrewMode } from '@/lib/characters/bus';
import { getClip } from '@/lib/characters/clips';
import { CrewDirector, type Performance } from '@/lib/characters/director';
import { bottomS, boxAt, freePath, glidePath, makeGeo, nearestS, normalise, pointAt, rotAt, type Edge, type Geo, type Key } from '@/lib/characters/perimeter';
import { crewProgress } from '@/lib/characters/progress';
import { CHARACTERS, CREW } from '@/lib/characters/registry';
import type { ShownLine } from '@/lib/characters/speech';
import { crewStore } from '@/lib/characters/store';
import { CHARACTER_IDS, PRIORITY_RANK, type CharacterId, type CharacterMode, type Priority } from '@/lib/characters/types';
import { benchElement } from '@/lib/craft/bus';

/* ============================================================================
   THE CREW STAGE — mounted ONCE, from AppRoot, so it survives every mode swap.
   It owns the single scheduler tick, the clip playback and the only speech bubble.
   The lane never takes the pointer; only the small hit button around each creature does.

   MOVEMENT. The crew lives on the edge of the screen and walks the whole border (floor mostly, sometimes up a side or along the
   top, tilted so its feet stay on the border). A creature's place is one number, `s`, along that loop (lib/characters/perimeter).
   It is moved ONLY with a compositor-friendly transform animation (translate + rotate, never left/top/bottom), one continuous
   glide per trip, while the pose clips play in place on top. An interrupted glide is settled at the spot actually reached, so a
   creature never snaps back or pops somewhere else.
   ========================================================================== */

const EMOTES: { label: string; clip: string }[] = [
  { label: 'Cheer', clip: 'cheer-two-arm' }, { label: 'Wave', clip: 'guide-wave-over' }, { label: 'Think', clip: 'guide-think-pose' }, { label: 'Nap', clip: 'transform-sleep-mode' },
];

/** Clips that make a creature disappear or pop up somewhere else: the crew never does that, it walks. */
const POP = /vanish|portal|teleport|disappear|swap-places|fall-off|climb-back|exit-/;
/** Clips that flip, spin or fall: fine on the floor, but on a wall they would carry the body off the screen */
const WALL_UNSAFE = /spin|flip|fall|slip|trip|upside|somersault|roll|tumble|backflip|dive|sideflip/;

const GIFT: Record<CharacterId, { clips: string[]; id: string; text: string }> = {
  kip: { clips: ['object-catch', 'item-hug', 'cheer-hop-clap'], id: 'kip.gift', text: 'For me? Thank you!' },
  vex: { clips: ['object-catch', 'item-hide-behind-back', 'prank-innocent-whistle'], id: 'vex.gift', text: 'Mine now. Thanks.' },
  orra: { clips: ['object-catch', 'object-inspect-close', 'cheer-two-arm'], id: 'orra.gift', text: 'How thoughtful. Noted.' },
};

const RUN_FAST = ['walk-hurry', 'walk-hurry', 'walk-bouncy'];
const RUN_EASY = ['walk-short', 'walk-march', 'walk-waddle', 'walk-follow-leader'];
const BREATHER = ['jump-small', 'walk-stop-skid', 'cheer-two-arm', 'jump-sideflip', 'jump-spin', 'cheer-spin-burst', 'idle-foot-tap'];
/** the idle poses a creature shows while it rests in a quiet spot */
const REST_IDLE = ['idle-blink-slow', 'idle-look-left', 'idle-look-right', 'idle-foot-tap'];
/** while the bench is busy, the crew hop about and float now and then */
const CRAFT_HOPS = ['jump-small', 'jump-small', 'jump-big', 'move-float'];

interface Slot { play: Playing; prio: Priority; solid: boolean }
/** where a creature is: on the border at `s`, or (free) out in the room with its feet at `free` */
interface State { s: number; rot: number; free?: { x: number; y: number } }
/** one continuous glide: keys of feet and tilt over time, and where it ends up */
interface Mover { id: number; keys: Key[]; dur: number; done: Promise<'done' | 'cancelled'>; finish: (v: 'done' | 'cancelled') => void; after: (k: Key) => State; raf: number; elapsed: number; last: number }

/** what a creature does in the middle of the screen, for a little while */
const ROOM_ACTS = ['move-float', 'jump-big', 'jump-small', 'cheer-two-arm', 'emotion-delighted'];

/** the on-screen event log is opt-in even in dev builds (add ?crewdebug to the address): it covers the game's own controls */
const DEV = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true' && process.env.NEXT_PUBLIC_DEPLOY_ENV !== 'production' && typeof window !== 'undefined' && window.location.search.includes('crewdebug');
const EDGE_DIR: Record<Edge, number> = { bottom: 0, right: -90, top: 180, left: 90 };

/** Where words, buttons and pictures sit on screen right now (leaf elements only; the crew's own parts are ignored). */
function contentBoxes(): DOMRect[] {
  const out: DOMRect[] = [];
  const vw = window.innerWidth, vh = window.innerHeight;
  const media = /^(BUTTON|A|INPUT|SELECT|TEXTAREA|IMG|SVG|CANVAS|VIDEO)$/;
  document.querySelectorAll<HTMLElement>('body *').forEach(el => {
    if (el.closest('.crew-lane,.crew-chip,.crew-panel,.crew-ask,.crew-debug')) return;
    if (el.childElementCount > 0 && !media.test(el.tagName)) return;
    if (!media.test(el.tagName) && !el.textContent?.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return;
    out.push(r);
  });
  return out;
}

/** where a glide is part-way through, given how far it has got (0..1): feet, tilt and (on the border) the place along it */
function sampleKeys(keys: Key[], t: number): Key {
  if (t <= keys[0].offset) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.offset) {
      const f = b.offset === a.offset ? 1 : (t - a.offset) / (b.offset - a.offset);
      return {
        offset: t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, rot: a.rot + (b.rot - a.rot) * f,
        s: a.s !== undefined && b.s !== undefined ? a.s + (b.s - a.s) * f : undefined,
      };
    }
  }
  return keys[keys.length - 1];
}

export function CharacterStage({ mode, gate }: { mode: CharacterMode; gate: boolean }) {
  const save = useSyncExternalStore(crewStore.subscribe, crewStore.get, crewStore.getServer);
  const mounted = useHasMounted();
  const [ready, setReady] = useState(mode !== 'main-evolution');
  const [line, setLine] = useState<ShownLine | null>(null);
  const [prankFor, setPrankFor] = useState<CharacterId | null>(null);
  const [appeared, setAppeared] = useState<Partial<Record<CharacterId, boolean>>>({ kip: true });
  const [ceremony, setCeremony] = useState<CharacterId | null>(null);
  const [panel, setPanel] = useState(false);
  const [ask, setAsk] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [emote, setEmote] = useState<{ id: CharacterId; mode: CharacterMode } | null>(null);
  const emoteFor = emote && emote.mode === mode ? emote.id : null;
  const setEmoteFor = (id: CharacterId | null) => setEmote(id ? { id, mode } : null);
  const osReduced = useSyncExternalStore(
    cb => { const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const director = useRef<CrewDirector | null>(null);
    const actors = useRef<Partial<Record<CharacterId, HTMLElement | null>>>({});
  const place = useRef<Record<CharacterId, State>>({ kip: { s: 0, rot: 0 }, vex: { s: 0, rot: 0 }, orra: { s: 0, rot: 0 } });
  const movers = useRef<Partial<Record<CharacterId, Mover>>>({});
  const moverSeq = useRef(0);
  const slots = useRef<Partial<Record<CharacterId, Slot>>>({});
  const idle = useRef<Partial<Record<CharacterId, Playing>>>({});
  const timers = useRef(new Set<number>());
  const pending = useRef<CharacterId[]>([]);
  const gateRef = useRef(gate);
  const modeRef = useRef(mode);
  const pointerDown = useRef(false);
  const reducedRef = useRef(false);
  const readyRef = useRef(false);
  const settingsBtn = useRef<HTMLButtonElement>(null);
  const clickTimer = useRef(0);
  const pressTimer = useRef(0);
  const pressed = useRef(false);
  const prankTimer = useRef(0);
  const held = useRef<Partial<Record<CharacterId, Playing>>>({});
  const ptr = useRef({ x: -1, y: -1 });
  const merging = useRef(false);
  const fleeAt = useRef<Partial<Record<CharacterId, number>>>({});
  const clicks = useRef<Partial<Record<CharacterId, number[]>>>({});
  const roaming = useRef<Partial<Record<CharacterId, boolean>>>({});
  const epoch = useRef(0);
  const dragItem = useRef(0);
  const lastCraft = useRef(0);
  const restAt = useRef<Partial<Record<CharacterId, { s: number; t: number }>>>({});

  const reduced = osReduced || save.settings.reducedMotion;
  const size = () => (typeof window !== 'undefined' && window.innerWidth <= 720 ? 64 : 84);
  const amp = () => (typeof window !== 'undefined' && window.innerWidth <= 720 ? 0.65 : 1);

  /* a stable director, created on first use (not during render) */
  const dir = useCallback((): CrewDirector => {
    if (!director.current) director.current = new CrewDirector({ reducedMotion: () => reducedRef.current });
    return director.current;
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const rootOf = (c: CharacterId): HTMLElement | null => actors.current[c]?.querySelector<HTMLElement>('[data-joint="root"]') ?? null;
  const tiltOf = (c: CharacterId): HTMLElement | null => actors.current[c]?.querySelector<HTMLElement>('.crew-rot') ?? null;

  /* ── where things are: the border ─────────────────────────────── */

  const getGeo = useCallback((): Geo => {
    const de = document.documentElement;
    return makeGeo(de.clientWidth, de.clientHeight, size(), 8); // the feet walk just inside the edge of the screen, the body stays on it
  }, []);

  /** put a creature where its state says, with no animation */
  const paint = useCallback((c: CharacterId, g: Geo = getGeo()) => {
    const el = actors.current[c]; if (!el) return;
    const st = place.current[c];
    const p = st.free ?? pointAt(g, st.s);
    const rot = st.free ? st.rot : rotAt(g, st.s);
    const b = boxAt(g, p.x, p.y, rot);
    el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0)`;
    el.dataset.edge = st.free ? 'bottom' : pointAt(g, st.s).edge; el.dataset.placed = '1';
    const t = tiltOf(c); if (t) t.style.transform = `rotate(${rot.toFixed(1)}deg)`;
  }, [getGeo]);

  /** jump straight to a place (only used when nobody can see it happen: first appearance, a resize) */
  const setS = useCallback((c: CharacterId, s: number) => {
    const g = getGeo();
    const n = normalise(g, s, rotAt(g, s));
    place.current[c] = { s: n.s, rot: n.rot }; paint(c, g);
  }, [getGeo, paint]);

  const homeS = useCallback((c: CharacterId) => {
    const g = getGeo(); const i = CHARACTER_IDS.indexOf(c);
    return bottomS(g, g.W - 52 - (size() + 6) * (i + 1), 0);
  }, [getGeo]);

  /** The quietest stretch of the border: where the least content sits under a creature, kept a little apart from the others. Cached for a minute. */
  const restSpot = useCallback((c: CharacterId): number => {
    const g = getGeo();
    const hit = restAt.current[c];
    if (hit && Date.now() - hit.t < 60_000) return hit.s;
    const boxes = contentBoxes();
    const others = CHARACTER_IDS.filter(o => o !== c && actors.current[o]).map(o => place.current[o].s);
    const gap = (a: number, b: number) => { const d = (((a - b) % g.P) + g.P) % g.P; return Math.min(d, g.P - d); };
    const scored: { s: number; score: number }[] = [];
    for (let s = 0; s < g.P; s += 24) {
      if (others.some(o => gap(s, o) < g.S + 14)) continue;
      const p = pointAt(g, s), b = boxAt(g, p.x, p.y, rotAt(g, s));
      const x0 = b.x - 12, x1 = b.x + g.S + 12, y0 = b.y - 12, y1 = b.y + g.S + 12;
      let score = 0;
      for (const r of boxes) {
        const ix = Math.min(r.right, x1) - Math.max(r.left, x0), iy = Math.min(r.bottom, y1) - Math.max(r.top, y0);
        if (ix > 0 && iy > 0) score += ix * iy;
      }
      scored.push({ s, score });
    }
    if (!scored.length) return place.current[c].s;
    const best = Math.min(...scored.map(x => x.score));
    const cands = scored.filter(x => x.score <= best * 1.15 + 40);
    const s = cands[Math.floor(Math.random() * cands.length)].s;
    restAt.current[c] = { s, t: Date.now() };
    return s;
  }, [getGeo]);

  const face = useCallback((c: CharacterId, d: 1 | -1) => {
    actors.current[c]?.querySelector<HTMLElement>('.crew-flip')?.setAttribute('data-facing', d < 0 ? 'left' : 'right');
  }, []);

  /** which way (+1/-1 along the border) is nearer the pointer */
  const dirToward = useCallback((c: CharacterId, p: { x: number; y: number }): 1 | -1 => {
    const g = getGeo(); const s = place.current[c].s;
    const a = pointAt(g, s + 80), b = pointAt(g, s - 80);
    const da = Math.hypot(a.x - p.x, a.y - p.y), db = Math.hypot(b.x - p.x, b.y - p.y);
    return da <= db ? 1 : -1;
  }, [getGeo]);

  /** Stop a creature's glide right now and settle it exactly where it has got to (never back where it started). */
  const stopGlide = useCallback((c: CharacterId, only?: number) => {
    const m = movers.current[c];
    if (!m || (only !== undefined && m.id !== only)) return;
    delete movers.current[c];
    cancelAnimationFrame(m.raf);
    place.current[c] = m.after(sampleKeys(m.keys, m.dur > 0 ? m.elapsed / m.dur : 1));
    paint(c);
    m.finish('cancelled');
  }, [paint]);

  /** Glide along keys of feet and tilt (linear in time, so the speed never pulses). `after` says where it ends up. */
  const runKeys = useCallback((c: CharacterId, keys: Key[], dur: number, after: (k: Key) => State): Mover | null => {
    const el = actors.current[c], tilt = tiltOf(c);
    if (!el || !tilt) return null;
    stopGlide(c);
    const g = getGeo();
    let finish: (v: 'done' | 'cancelled') => void = () => {};
    const done = new Promise<'done' | 'cancelled'>(r => { finish = r; });
    const m: Mover = { id: ++moverSeq.current, keys, dur, done, finish, after, raf: 0, elapsed: 0, last: performance.now() };
    // Driven by the frame clock, not a browser animation: each frame advances the glide by at most 100 ms, so a
    // stall (the page busy, a tab in the background) slows the crew down instead of letting it jump ahead.
    const frame = (now: number) => {
      if (movers.current[c] !== m) return;
      m.elapsed = Math.min(m.dur, m.elapsed + Math.min(100, Math.max(0, now - m.last)));
      m.last = now;
      const k = sampleKeys(keys, m.dur > 0 ? m.elapsed / m.dur : 1);
      const b = boxAt(g, k.x, k.y, k.rot);
      el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0)`;
      tilt.style.transform = `rotate(${k.rot.toFixed(1)}deg)`;
      if (m.elapsed >= m.dur) {
        delete movers.current[c];
        place.current[c] = after(keys[keys.length - 1]);
        paint(c, g);
        finish('done');
        return;
      }
      m.raf = requestAnimationFrame(frame);
    };
    movers.current[c] = m;
    m.raf = requestAnimationFrame(frame);
    return m;
  }, [getGeo, paint, stopGlide]);

  /** One continuous glide along the border from where it is to s1. */
  const glide = useCallback((c: CharacterId, s1: number, dur: number): Mover | null => {
    const g = getGeo(); const st = place.current[c];
    if (st.free) return null;
    if (!tiltOf(c) || !actors.current[c]) { setS(c, s1); return null; }
    return runKeys(c, glidePath(g, st.s, s1), dur, k => ({ s: k.s ?? s1, rot: rotAt(g, k.s ?? s1) }));
  }, [getGeo, runKeys, setS]);

  /* ── playback ─────────────────────────────────────────────────── */

  const startIdle = useCallback((c: CharacterId) => {
    if (reducedRef.current || idle.current[c] || slots.current[c]) return;
    const clip = getClip('idle-breathe'); const el = rootOf(c);
    if (clip && el) idle.current[c] = playClip(el, clip, { char: c, unit: size(), amp: amp(), reduced: false });
  }, []);
  const stopIdle = useCallback((c: CharacterId) => { idle.current[c]?.cancel(); delete idle.current[c]; }, []);

  const cancelAll = useCallback(() => {
    epoch.current++; roaming.current = {};
    for (const t of timers.current) window.clearTimeout(t);
    timers.current.clear();
    for (const c of CHARACTER_IDS) { stopGlide(c); slots.current[c]?.play.cancel(); delete slots.current[c]; held.current[c]?.release(); delete held.current[c]; stopIdle(c); dir().clearPlaying(c); }
    dir().speech.clear();
  }, [dir, stopGlide, stopIdle]);

  /** Play one clip for one or more creatures on one shared timeline. Resolves when the lead's clip ends (or is cancelled). */
  const play = useCallback((cast: CharacterId[], clipId: string, prio: Priority, travelDir?: 1 | -1, hint?: 'toward-cursor' | 'away-cursor', quiet = false, keepGlide = false): Promise<'done' | 'cancelled' | 'skipped'> => {
    let clip = getClip(clipId);
    if (clip && (clip.holdEnd || POP.test(clip.id))) clip = getClip('emotion-curious'); // nobody pops out and back in; they walk
    // on the border a flip, spin or fall would swing the body off the screen (under the floor, off a wall): they do a calm pose there
    if (clip && WALL_UNSAFE.test(clip.id) && cast.some(c => !place.current[c].free)) clip = getClip('emotion-delighted') ?? clip;
    if (!clip || !readyRef.current) return Promise.resolve('skipped');
    const cl = clip;
    for (const c of cast) {
      const cur = slots.current[c];
      if (cur && (PRIORITY_RANK[cur.prio] > PRIORITY_RANK[prio] || (cur.solid && PRIORITY_RANK[cur.prio] === PRIORITY_RANK[prio]))) return Promise.resolve('skipped');
    }
    let lead: Promise<'done' | 'cancelled'> = Promise.resolve('done');
    cast.forEach((c, role) => {
      slots.current[c]?.play.cancel(); stopIdle(c);
      held.current[c]?.release(); delete held.current[c];
      if (!keepGlide) stopGlide(c); // whatever it was doing, it stops where it stands
      const el = rootOf(c);
      const toCursor: 1 | -1 = dirToward(c, ptr.current);
      const d: 1 | -1 = travelDir ?? (hint === 'toward-cursor' ? toCursor : hint === 'away-cursor' ? (toCursor === 1 ? -1 : 1) : (Math.random() < 0.5 ? 1 : -1));
      // a travelling clip never moves faster than a run (about 420 px a second), however short the clip is
      const total = Math.max(250, cl.durationMs * CHARACTERS[c].retarget.speed, (Math.abs(cl.travel ?? 0) * size() * amp()) / 0.42);
      if (cl.travel && !reducedRef.current && !keepGlide && !place.current[c].free) {
        face(c, cl.travel * d >= 0 ? 1 : -1);
        glide(c, place.current[c].s + cl.travel * size() * amp() * d, total);
      }
      const p = playClip(el, cl, { char: c, unit: size(), amp: amp(), role, dir: d, reduced: reducedRef.current, noTravel: true });
      const slot: Slot = { play: p, prio, solid: !cl.interruptible };
      slots.current[c] = slot;
      if (!quiet) dir().markPlaying(c, total);
      p.finished.then(() => { if (slots.current[c] === slot) { delete slots.current[c]; if (!quiet) dir().clearPlaying(c); if (cl.holdEnd) held.current[c] = p; else startIdle(c); } });
      if (role === 0) lead = p.finished;
    });
    return lead;
  }, [dir, dirToward, face, glide, startIdle, stopGlide, stopIdle]);

  /** Back from the room to the nearest place on the border, turning to face the wall as it lands. */
  const returnToLoop = useCallback(async (c: CharacterId): Promise<'done' | 'cancelled'> => {
    stopGlide(c); // settle wherever it has got to before reading where that is
    const g = getGeo(); const st = place.current[c];
    if (!st.free) return 'done';
    const from = st.free;
    const b = nearestS(g, from.x, from.y, st.s);
    const p = pointAt(g, b);
    const rotB = normalise(g, 0, rotAt(g, b)).rot;
    const dist = Math.hypot(p.x - from.x, p.y - from.y);
    const m = runKeys(c, freePath({ x: from.x, y: from.y, rot: st.rot }, { x: p.x, y: p.y, rot: rotB }), Math.max(500, (dist / 170) * 1000), () => ({ s: b, rot: rotAt(g, b) }));
    if (!m) { place.current[c] = { s: b, rot: rotAt(g, b) }; paint(c, g); return 'done'; }
    return m.done;
  }, [getGeo, paint, runKeys, stopGlide]);

  /** A place in the quiet middle of the screen for a visit: the one with the least content under it, clear of the others. */
  const pickRoomSpot = useCallback((c: CharacterId): { x: number; y: number } | null => {
    const g = getGeo();
    const boxes = contentBoxes();
    const others = CHARACTER_IDS.filter(o => o !== c && actors.current[o]).map(o => {
      const st = place.current[o]; return st.free ?? pointAt(g, st.s);
    });
    const cands: { x: number; y: number; score: number }[] = [];
    for (let fx = 0.3 * g.W; fx <= 0.7 * g.W; fx += 40) {
      for (let fy = 0.4 * g.H; fy <= 0.75 * g.H; fy += 40) {
        if (others.some(p => Math.hypot(p.x - fx, p.y - fy) < g.S * 1.6)) continue;
        const x0 = fx - g.h - 8, x1 = fx + g.h + 8, y0 = fy - g.S - 8, y1 = fy + 8;
        let score = 0;
        for (const r of boxes) {
          const ix = Math.min(r.right, x1) - Math.max(r.left, x0), iy = Math.min(r.bottom, y1) - Math.max(r.top, y0);
          if (ix > 0 && iy > 0) score += ix * iy;
        }
        cands.push({ x: fx, y: fy, score });
      }
    }
    if (!cands.length) return null;
    const best = Math.min(...cands.map(x => x.score));
    const pick = cands.filter(x => x.score <= best * 1.15 + 40);
    return pick[Math.floor(Math.random() * pick.length)];
  }, [getGeo]);

  /** A visit into the room: they leave the border, float or hop in the quiet middle of the screen, then go back to the border. */
  const excursion = useCallback(async (c: CharacterId): Promise<'done' | 'cancelled'> => {
    stopGlide(c); // a glide still running must be settled first, or the visit would start from where it began
    const g = getGeo(); const st = place.current[c];
    const spot = pickRoomSpot(c);
    if (!spot) return 'done';
    const from = pointAt(g, st.s);
    const rot0 = normalise(g, 0, rotAt(g, st.s)).rot;
    const sNear = st.s;
    const dist = Math.hypot(spot.x - from.x, spot.y - from.y);
    const m = runKeys(c, freePath({ x: from.x, y: from.y, rot: rot0 }, { x: spot.x, y: spot.y, rot: 0 }), Math.max(900, (dist / 170) * 1000), k => ({ s: sNear, rot: k.rot, free: { x: k.x, y: k.y } }));
    if (!m) return 'done';
    if (await m.done !== 'done') return 'cancelled';
    const acts = [...ROOM_ACTS].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
    for (const clip of acts) {
      if (!place.current[c].free) return 'cancelled';
      await play([c], clip, 'ambient', undefined, undefined, true, true);
    }
    await new Promise<void>(res => window.setTimeout(res, 800));
    return returnToLoop(c);
  }, [getGeo, pickRoomSpot, play, returnToLoop, runKeys, stopGlide]);

  /** Go to s1 along the border in one continuous glide, running the given walk poses in place on top. */
  const travelTo = useCallback(async (c: CharacterId, s1: number, clips: string[], prio: Priority, quiet: boolean, speed: number): Promise<'done' | 'cancelled' | 'skipped'> => {
    const my = epoch.current;
    if (place.current[c].free) { if (await returnToLoop(c) !== 'done') return 'cancelled'; }
    const dist = Math.abs(s1 - place.current[c].s);
    if (dist < 6) return 'done';
    const sign: 1 | -1 = s1 > place.current[c].s ? 1 : -1;
    stopGlide(c);
    const m = glide(c, s1, Math.max(350, (dist / speed) * 1000));
    face(c, sign);
    if (!m) return 'done';
    let arrived = false;
    void m.done.then(r => { if (r === 'done') arrived = true; });
    while (!arrived) {
      if (my !== epoch.current || movers.current[c] !== m) return 'cancelled';
      const r = await play([c], clips[Math.floor(Math.random() * clips.length)], prio, sign, undefined, quiet, true);
      if (r !== 'done') { stopGlide(c, m.id); return r === 'skipped' ? 'skipped' : 'cancelled'; }
    }
    return 'done';
  }, [face, glide, play, returnToLoop, stopGlide]);

  /** walk along the floor to horizontal position x */
  const walkTo = useCallback(async (c: CharacterId, x: number, clips: string[] = ['walk-hurry']) => {
    const g = getGeo();
    return travelTo(c, bottomS(g, x, place.current[c].s), clips, 'normal', false, 330);
  }, [getGeo, travelTo]);

  /** The crew's default state: patrolling the border, mostly the floor, sometimes up a side or along the top, now and then a hop. */
  const wander = useCallback(async (c: CharacterId) => {
    if (roaming.current[c]) return;
    roaming.current[c] = true;
    const my = epoch.current;
    const free = () => {
      const d = dir();
      return my === epoch.current && readyRef.current && !reducedRef.current && !merging.current && d.safe() && d.active().includes(c) && crewStore.get().settings.ambientSkits && !gateRef.current;
    };
    try {
      for (let trip = 0; trip < 60 && free(); trip++) {
        // out in the room (an interrupted visit) they come back first; now and then a visit starts
        if (place.current[c].free) { if (await returnToLoop(c) !== 'done') return; }
        else if (Math.random() < 0.3) { if (await excursion(c) !== 'done') return; continue; }
        const g = getGeo(); const from = place.current[c].s;
        const resting = Math.random() < 0.6; // most trips end at the quiet spot; the rest patrol the border
        const r = Math.random();
        let u = r < 0.62 ? Math.random() * g.A : r < 0.76 ? g.A + Math.random() * g.V : r < 0.9 ? g.A + g.V + Math.random() * g.A : 2 * g.A + g.V + Math.random() * g.V;
        const others = CHARACTER_IDS.filter(o => o !== c && actors.current[o]);
        if (others.length && Math.random() < 0.25) u = place.current[others[Math.floor(Math.random() * others.length)]].s + (Math.random() < 0.5 ? -1 : 1) * g.S * 0.9; // chase someone
        let s1 = u + g.P * Math.round((from - u) / g.P); // the short way round
        if (Math.abs(s1 - from) < g.S * 1.5) s1 = from + (Math.random() < 0.5 ? -1 : 1) * (g.S * 2 + Math.random() * g.A * 0.3);
        if (resting) { const rs = restSpot(c); s1 = rs + g.P * Math.round((from - rs) / g.P) + (Math.random() - 0.5) * g.S * 0.5; }
        const fast = !resting && Math.random() < 0.55;
        const res = await travelTo(c, s1, fast ? RUN_FAST : RUN_EASY, 'ambient', true, fast ? 330 + Math.random() * 120 : 150 + Math.random() * 60);
        if (res !== 'done' || !free() || slots.current[c]) return;
        if (resting) {
          // at the quiet spot: an idle pose, then they stay put for a few seconds (the breathing loop keeps going)
          const idleClip = REST_IDLE[Math.floor(Math.random() * REST_IDLE.length)];
          if (await play([c], idleClip, 'ambient', undefined, undefined, true, true) !== 'done') return;
          await new Promise<void>(res2 => window.setTimeout(res2, 3500 + Math.random() * 4500));
        } else if (Math.random() < 0.6) {
          const b = await play([c], BREATHER[Math.floor(Math.random() * BREATHER.length)], 'ambient', undefined, undefined, true, true);
          if (b !== 'done') return;
        } else await new Promise<void>(res2 => window.setTimeout(res2, 250 + Math.random() * 700));
      }
    } finally { if (my === epoch.current) roaming.current[c] = false; }
  }, [dir, excursion, getGeo, play, restSpot, returnToLoop, travelTo]);

  /** Someone gave one of them something (an inventory item or a bench piece dropped on them): they catch it, react, and the others come over. */
  const receive = useCallback((c: CharacterId) => {
    const d = dir();
    if (!readyRef.current || !d.active().includes(c)) return;
    const g = GIFT[c];
    d.speech.offer({ speakerId: c, lineId: g.id, text: g.text, priority: 'major', expiresAt: Date.now() + 3000, voiceCueId: `vc.${c}.${g.id}` }, true);
    void (async () => { for (const id of g.clips) { if (await play([c], id, 'major') !== 'done') break; } })();
    const geo = getGeo();
    for (const o of d.active().filter(x => x !== c)) {
      void (async () => {
        const near = place.current[c].s + (place.current[o].s >= place.current[c].s ? 1 : -1) * geo.S * 0.9;
        await travelTo(o, near, RUN_FAST, 'normal', false, 340);
        void play([o], 'emotion-curious', 'normal');
      })();
    }
  }, [dir, getGeo, play, travelTo]);
  const giveAt = useCallback((x: number, y: number) => {
    for (const c of CHARACTER_IDS) {
      const r = actors.current[c]?.getBoundingClientRect(); if (!r || !r.width) continue;
      if (x >= r.left - 18 && x <= r.right + 18 && y >= r.top - 18 && y <= r.bottom + 18) { receive(c); return; }
    }
  }, [receive]);

  /** A real, opt-in bench turn: plan (validate), walk, pick up, carry, then ask the Workbench to combine through its normal path. */
  const runMerge = useCallback(async (p: Performance) => {
    const c = p.characterId;
    const plan = await actionRegistry.run(p.mode, 'bench.tryRandomMerge', { phase: 'plan' });
    if (!plan.ok) return; // nothing legal / not safe: skip, no nagging
    merging.current = true;
    try {
    const inv = document.getElementById('inv')?.getBoundingClientRect();
    const bench = benchElement()?.getBoundingClientRect();
    await play([c], 'emotion-curious', 'normal');
    if (inv) await walkTo(c, inv.left + inv.width / 2 - size() / 2);
    if (await play([c], 'object-squat-pickup', 'normal') !== 'done') return;
    if (bench) {
      if (await walkTo(c, bench.left + bench.width / 2 - size() / 2, ['object-carry-walk']) !== 'done') return;
    }
    const hold = play([c], 'mode-puzzle-hold-breath', 'normal');
    const run = await actionRegistry.run(p.mode, 'bench.tryRandomMerge', { phase: 'run' });
    void hold;
    if (!run.ok) { await play([c], 'emotion-apologetic', 'normal'); }
    else if (run.data?.outcome === 'fail') { await play([c], 'emotion-embarrassed', 'normal'); crewStore.bump(`${c}>vex`, 'patience'); }
    else await play([c], 'object-place-carefully', 'normal');
    await walkTo(c, homeS(c));
    } finally { merging.current = false; }
  }, [homeS, play, walkTo]);

  const perform = useCallback((p: Performance) => {
    const d = dir();
    const go = () => {
      if (!d.active().includes(p.characterId)) return;
      if (p.actionId === 'bench.tryRandomMerge') { void runMerge(p); return; }
      if (p.speech) d.speech.offer(p.speech, p.source === 'ui');
      if (p.prank) { setPrankFor(p.characterId); window.clearTimeout(prankTimer.current); prankTimer.current = window.setTimeout(() => setPrankFor(null), 2600); }
      void play(p.cast, p.clipId, p.priority, undefined, p.hint).then(r => {
        if (r !== 'skipped' && p.cast.length > 1) { crewStore.bump(`${p.cast[0]}>${p.cast[1]}`, p.clipId.startsWith('fight') ? 'rivalry' : 'trust'); }
      });
      if (p.actionId === 'bench.returnItemHome') {
        later(async () => {
          const r = await actionRegistry.run(p.mode, 'bench.returnItemHome');
          if (r.ok) { crewStore.bump('vex>kip', 'debt'); later(() => { void play(['vex'], 'prank-innocent-whistle', 'ambient'); }, 1200); }
        }, 900);
      }
      if (p.followUp) later(() => { void play(p.cast, p.followUp!.clipId, 'ambient'); }, p.followUp.delayMs);
      if (DEV) setDebugLog(l => [`${new Date().toLocaleTimeString()} ${p.eventId} -> ${p.characterId}:${p.clipId}`, ...l].slice(0, 8));
    };
    if (p.delayMs > 0) later(go, p.delayMs); else go();
  }, [dir, later, play, runMerge]);

  /* ── wiring: bus, bridge, scheduler tick, context ─────────────── */

  useEffect(() => { reducedRef.current = reduced; if (reduced) cancelAll(); else for (const c of CHARACTER_IDS) if (appeared[c]) startIdle(c); }, [reduced, cancelAll, startIdle, appeared]);
  // keep the director in step with the save
  useEffect(() => {
    const d = dir();
    d.setSettings(save.settings); d.disclosureSeen = save.disclosureSeen;
    d.setRoster(CHARACTER_IDS.filter(c => save.unlocked[c] !== undefined && (appeared[c] || c === 'kip')));
    if (!save.settings.enabled) cancelAll();
  }, [save, appeared, dir, cancelAll]);

  // mode change: cancel everything, tell the director, announce
  useEffect(() => {
    modeRef.current = mode; setCrewMode(mode);
    const d = dir(); d.setMode(mode);
    cancelAll();
    for (const c of CHARACTER_IDS) if (appeared[c]) startIdle(c);
    if (mode !== 'main-evolution') readyRef.current = true;
    emitCrew(mode, 'mode-switch', { to: mode }, 'ui');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { gateRef.current = gate; }, [gate]);

  // the characters never fire before the game is ready; any event from the game proves it is
  useEffect(() => {
    const off = characterBus.on(e => {
      if (e.id === 'app-enter') { readyRef.current = true; setReady(true); }
      if (e.id === 'inventory-drag-item') dragItem.current = Date.now();
      if (/^(craft-|bench-|technique-|inventory-drop)/.test(e.id)) lastCraft.current = Date.now();
      for (const p of dir().handle(e)) perform(p);
    });
    const offBridge = attachRetentionBridge();
    return () => { off(); offBridge(); };
  }, [dir, perform]);

  // what the stage itself knows about the player's state
  useEffect(() => provideCrewContext(() => ({
    hidden: document.hidden,
    dragging: pointerDown.current,
    typing: (() => { const a = document.activeElement as HTMLElement | null; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable); })(),
    modalOpen: !!document.querySelector('[aria-modal="true"]:not([hidden])'),
    gateOpen: gateRef.current,
    guideActive: !!document.querySelector('.guide-glow, .sx-guide, [data-guide-step]'),
  })), []);

  // real progress → roster. Kip is there from the start; the others arrive with a ceremony, once.
  useEffect(() => {
    const apply = () => {
      for (const id of crewProgress.earned()) {
        const fresh = crewStore.unlock(id);
        if ((fresh || !crewStore.get().ceremonySeen[id]) && id !== 'kip' && !pending.current.includes(id)) pending.current.push(id);
      }
      for (const c of CHARACTER_IDS) if (crewStore.get().ceremonySeen[c]) setAppeared(a => (a[c] ? a : { ...a, [c]: true }));
    };
    apply();
    return crewProgress.subscribe(apply);
  }, []);

  // input, visibility, gaze, resize
  useEffect(() => {
    const d = dir();
    let raf = 0; let gx = 0, gy = 0;
    const move = (e: PointerEvent) => {
      d.noteInput(); gx = e.clientX; gy = e.clientY; ptr.current = { x: gx, y: gy };
      if (raf || reducedRef.current) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        for (const c of CHARACTER_IDS) {
          const el = actors.current[c]; if (!el) continue;
          const r = el.getBoundingClientRect();
          const dx = gx - (r.left + r.width / 2), dy = gy - (r.top + r.height * 0.45);
          const dist = Math.hypot(dx, dy);
          const k = dist > 700 ? 0 : 3 / Math.max(40, dist);
          if (dist < 90 && !merging.current && !slots.current[c] && !pointerDown.current && Date.now() - (fleeAt.current[c] ?? 0) > 22_000 && Math.random() < 0.08) {
            fleeAt.current[c] = Date.now(); void play([c], 'screen-flee-cursor', 'ambient', undefined, 'away-cursor');
          }
          // the gaze, turned into the creature's own frame (it may be standing on a wall, and facing either way)
          const th = ((EDGE_DIR[(el.dataset.edge as Edge) ?? 'bottom']) * Math.PI) / 180;
          let lx = dx * Math.cos(th) + dy * Math.sin(th); const ly = -dx * Math.sin(th) + dy * Math.cos(th);
          if (el.querySelector('.crew-flip')?.getAttribute('data-facing') === 'left') lx = -lx;
          const eye = el.querySelector<HTMLElement>('[data-joint="eye"]');
          const v = `${Math.round(lx * k * 2) / 2}px ${Math.round(ly * k * 2) / 2}px`;
          if (eye && eye.style.translate !== v) eye.style.translate = v;
        }
      });
    };
    const down = () => { pointerDown.current = true; d.noteInput(); };
    const up = (e: PointerEvent) => {
      pointerDown.current = false; d.noteInput();
      // an inventory item let go over one of them is a gift
      if (dragItem.current && Date.now() - dragItem.current < 30_000) { dragItem.current = 0; giveAt(e.clientX, e.clientY); }
    };
    const piece = (e: Event) => { const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail; giveAt(x, y); };
    window.addEventListener('evo:piece-drop', piece);
    const key = () => d.noteInput();
    let lastScroll = 0;
    const scroll = () => { d.noteInput(); const n = Date.now(); if (n - lastScroll > 8000) { lastScroll = n; emitCrew(modeRef.current, 'page-scroll', undefined, 'ui'); } };
    const vis = () => {
      if (document.hidden) cancelAll();
      else { for (const c of CHARACTER_IDS) if (appeared[c]) startIdle(c); emitCrew(modeRef.current, 'app-return-focus', undefined, 'ui'); }
    };
    const resize = () => { restAt.current = {}; for (const c of CHARACTER_IDS) { stopGlide(c); setS(c, homeS(c)); } };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    window.addEventListener('keydown', key, { passive: true });
    window.addEventListener('wheel', key, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true, capture: true });
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('evo:piece-drop', piece);
      window.removeEventListener('keydown', key); window.removeEventListener('wheel', key);
      window.removeEventListener('scroll', scroll, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [dir, cancelAll, startIdle, appeared, setS, homeS, play, giveAt, stopGlide]);

  // THE scheduler: one timer for the whole crew
  useEffect(() => {
    const d = dir();
    const tick = () => {
      if (!readyRef.current) return;
      for (const p of d.tick()) perform(p);
      // between performances they are never standing about: off patrolling the border
      for (const c of d.active()) if (!roaming.current[c] && !slots.current[c] && !held.current[c]) void wander(c);
      // while the bench is busy, a creature now and then hops or floats where it stands
      if (modeRef.current === 'main-evolution' && Date.now() - lastCraft.current < 30_000 && !merging.current && Math.random() < 0.2) {
        const free = d.active().filter(c => actors.current[c] && !slots.current[c] && !held.current[c]);
        if (free.length) void play([free[Math.floor(Math.random() * free.length)]], CRAFT_HOPS[Math.floor(Math.random() * CRAFT_HOPS.length)], 'ambient', undefined, undefined, true, true);
      }
      // keep each speech bubble on the screen side of its creature, whichever edge it is on
      const g = getGeo();
      for (const c of CHARACTER_IDS) {
        const el = actors.current[c]; if (!el) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const near: [Edge, number][] = [['left', cx - g.S / 2], ['right', g.W - cx - g.S / 2], ['top', cy - g.S / 2], ['bottom', g.H - cy - g.S / 2]];
        const edge = near.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
        if (el.dataset.edge !== edge) el.dataset.edge = edge;
        const shift = (cx < 100 ? 100 - cx : cx > g.W - 100 ? g.W - 100 - cx : 0);
        el.style.setProperty('--bshift', `${Math.round(shift)}px`);
      }
      // ceremony queue: only at a quiet moment
      if (!ceremonyBusy.current && pending.current.length && d.calm() && !gateRef.current) {
        const id = pending.current.shift()!;
        ceremonyBusy.current = true;
        setAppeared(a => ({ ...a, [id]: true }));
        setCeremony(id);
        later(() => {
          stopGlide(id); setS(id, homeS(id)); face(id, -1);
          void play([id], 'transform-unlock-evolution', 'major');
          emitCrew(modeRef.current, 'crew-arrive-together', { characterId: id }, 'crew');
        }, 120);
        later(() => { crewStore.markCeremony(id); setCeremony(null); ceremonyBusy.current = false; }, 4200);
      }
      // the one-time note about bench turns, asked at a natural idle moment
      const s = crewStore.get();
      const want = s.settings.enabled && !s.disclosureSeen && actionRegistry.has(modeRef.current, 'bench.tryRandomMerge') && d.calm() && d.idleFor() > 20_000 && d.active().includes('kip');
      setAsk(a => (a === want ? a : want));
      const t = gateRef.current || !!document.querySelector('[aria-modal="true"]:not([hidden])');
      setTucked(x => (x === t ? x : t));
    };
    const ceremonyBusy = { current: false };
    const id = window.setInterval(tick, 1000);
    const sub = d.speech.subscribe(setLine);
    return () => { window.clearInterval(id); sub(); };
  }, [dir, perform, later, setS, homeS, face, play, wander, getGeo, stopGlide]);

  // set the home slots when creatures first appear
  useEffect(() => {
    if (!mounted) return;
    for (const c of CHARACTER_IDS) if (appeared[c] && actors.current[c] && !actors.current[c]!.dataset.placed) { setS(c, homeS(c)); startIdle(c); }
  }, [mounted, appeared, ready, setS, homeS, startIdle]);

  // unmount: kill every timeline, timer and subscription
  useEffect(() => () => { cancelAll(); }, [cancelAll]);

  /* ── the creature's own controls ──────────────────────────────── */

  const poke = (c: CharacterId, id: string) => emitCrew(modeRef.current, id, { characterId: c }, 'ui');
  const onClick = (c: CharacterId, now: number) => {
    if (pressed.current) { pressed.current = false; return; }
    const recent = [...(clicks.current[c] ?? []).filter(t => now - t < 2600), now];
    clicks.current[c] = recent;
    if (recent.length >= 4) { clicks.current[c] = []; window.clearTimeout(clickTimer.current); clickTimer.current = 0; void play([c], 'screen-annoyed-clicks', 'major'); return; }
    if (recent.length === 3) { window.clearTimeout(clickTimer.current); clickTimer.current = 0; void play([c], 'screen-repeat-clicks', 'normal'); return; }
    if (clickTimer.current) { window.clearTimeout(clickTimer.current); clickTimer.current = 0; poke(c, 'character-double-click'); return; }
    clickTimer.current = window.setTimeout(() => { clickTimer.current = 0; poke(c, 'character-click'); }, 260);
  };
  const onKey = (c: CharacterId, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(c, 'character-keyboard-activate'); }
    else if (e.key === 'Escape') setEmoteFor(null);
    else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); setEmoteFor(c); }
  };
  const pressStart = (c: CharacterId) => { pressed.current = false; window.clearTimeout(pressTimer.current); pressTimer.current = window.setTimeout(() => { pressed.current = true; setEmoteFor(c); }, 550); };
  const pressEnd = () => window.clearTimeout(pressTimer.current);
  useEffect(() => () => { window.clearTimeout(pressTimer.current); window.clearTimeout(clickTimer.current); window.clearTimeout(prankTimer.current); }, []);

  if (!mounted || !save.settings.enabled) return null;
  const visible = CREW.filter(c => save.unlocked[c.id] !== undefined && appeared[c.id] && save.settings.perCharacter[c.id]);

  return (
    <>
      <div className="crew-lane" data-tucked={tucked || !ready ? '1' : undefined} data-mode={mode}>
        {visible.map(c => (
          <div key={c.id} className="crew-actor" data-char={c.id} data-edge="bottom" ref={el => { actors.current[c.id] = el; }}>
            <div className="crew-rot">
              <div className="crew-flip" data-facing="right"><CharacterRig id={c.id} size={size()} /></div>
              <button type="button" className="crew-hit" aria-label={`${c.name}, ${c.role}. Activate for a reaction.`}
                onClick={e => onClick(c.id, e.timeStamp)} onKeyDown={e => onKey(c.id, e)}
                onPointerDown={() => pressStart(c.id)} onPointerUp={pressEnd} onPointerLeave={() => { pressEnd(); poke(c.id, 'pointer-leaves-character'); }}
                onPointerEnter={() => poke(c.id, 'pointer-near-character')} />
            </div>
            {line?.speakerId === c.id && !tucked && <CharacterSpeechBubble line={line} />}
            {prankFor === c.id && <CharacterPrankTag />}
            {emoteFor === c.id && (
              <div className="crew-emotes" role="group" aria-label={`${c.name} emotes`}>
                {EMOTES.map(e => <button key={e.clip} type="button" onClick={() => { setEmoteFor(null); void play([c.id], e.clip, 'normal'); }}>{e.label}</button>)}
                <button type="button" onClick={() => setEmoteFor(null)} aria-label="Close emotes">×</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="crew-sr" aria-live="polite" role="status">{line && save.settings.dialogue ? `${CHARACTERS[line.speakerId].name}: ${line.text}` : ''}</div>
      <button ref={settingsBtn} type="button" className="crew-chip" aria-label="Crew settings" aria-expanded={panel} aria-haspopup="dialog" onClick={() => setPanel(p => !p)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="3.2" /><path d="M5 20c.6-3.6 3.4-5.4 7-5.4s6.4 1.8 7 5.4" /></svg>
      </button>
      {panel && <CharacterSettings save={save} onClose={() => { setPanel(false); settingsBtn.current?.focus(); }} />}
      {ask && !panel && <CharacterDisclosure onAnswer={a => { crewStore.acceptDisclosure(a); setAsk(false); }} />}
      {ceremony && <CharacterUnlockCeremony id={ceremony} />}
      {DEV && debugLog.length > 0 && <div className="crew-debug">{debugLog.join('\n')}</div>}
    </>
  );
}
