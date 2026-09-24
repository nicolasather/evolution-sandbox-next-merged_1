'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerBench, type SpawnOptions } from '@/lib/craft/bus';
import { getVolume, play, setSoundEnabled, setVolume, soundEnabled, subscribeSound, unlockAudio } from '@/lib/craft/audio';
import { Fx, readPalette } from '@/lib/craft/fx';
import { Gesture, segDist } from '@/lib/craft/gesture';
import { drawHand } from '@/lib/craft/hand';
import { flyHome } from '@/lib/craft/homeFlight';
import { loadBench, saveBench, UndoStack, type Placed } from '@/lib/craft/benchMemory';
import { CUE_LIMIT, instantEnabled, markStepSeen, seenSteps, setInstant, subscribePrefs } from '@/lib/craft/prefs';
import { CraftSession } from '@/lib/craft/session';
import { deriveSpec, tierOf } from '@/lib/craft/specs';
import { stepHint } from '@/lib/craft/steps';
import type { Body, StepKind, Tier, ZoneId } from '@/lib/craft/types';
import { World } from '@/lib/craft/world';
import type { Engine } from '@/lib/engine';
import { ACTIONS, ACTION_ORDER } from '@/lib/processing/actions';
import type { ActionId, CombineResult, ProcessResult } from '@/lib/types';
import { nearLine } from '@/lib/near';
import { HandIcon } from './HandIcon';

/* ============================================================================
   WORKBENCH — the ground where things are worked and put together.

   Resources from the inventory land here as bodies with weight. Two things
   can be done with them:

     ASSEMBLE  Bring 2–5 together. When the set is a real recipe it comes
               together; when it is on the road to one it holds and trembles;
               when it is not, the ground says why (and never what).
     PROCESS   Take up a hand — Brush, Smash, Cut, Separate or Dig — and work
               ONE resource with the gesture the hand needs. Materials answer
               by what they are made of.

   Nothing here decides what anything makes, opens tiers, or records routes;
   that stays in lib/engine.ts. The hands-on CraftSession runs only for a
   milestone made from a pair. Anything on the ground can be put away (right
   click, long press, Delete) and flies home to the inventory; a piece hit hard
   enough into a wall goes through it, overshoots, and comes home the same way.
   ========================================================================== */

const ZONES: { id: ZoneId; label: string }[] = [
  { id: 'hearth', label: 'Hearth' },
  { id: 'anvil', label: 'Anvil' },
  { id: 'basin', label: 'Basin' },
];

interface Hud { i: number; total: number; verb: string; kind: StepKind; hint: string; cue: boolean }
interface Api {
  clear(): void; cancel(): void; skip(): void; rotate(): void;
  setMode(m: ActionId | null): void; undo(): void; finishWork(): void;
}
interface Note { key: number; text: string; sub?: string; tone: 'info' | 'warn' | 'good' }

interface Props {
  engine: Engine;
  /** The workspace view is showing. The loop sleeps otherwise. */
  active: boolean;
  /** Ask the game what these pieces make. Returns the engine's answer. */
  onCombine: (ids: string[]) => CombineResult;
  /** Ask the game what working one resource makes. */
  onProcess: (id: string, action: ActionId) => ProcessResult;
  /** A new attempt begins: the previous outcome gives way. */
  onBegin: () => void;
  /** The player asked, on purpose, to read about a piece. Never called by selecting or dragging. */
  onInspect: (id: string) => void;
  /** A plain click on the bare scenery: not on a piece, not during a craft, not after a drag. */
  onScenery?: (clientX: number, clientY: number) => void;
  /** A hint at level 3+ leans on this action: its hand pulses. */
  hintAction?: ActionId | null;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const pairId = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A group of bodies that are touching, directly or through each other. */
type Cluster = Body[];
const sigOf = (c: Cluster) => c.map(b => b.uid).sort((x, y) => x - y).join('|');

export function Workbench({ engine, active, onCombine, onProcess, onBegin, onInspect, onScenery, hintAction = null }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const selIdRef = useRef<string | null>(null);
  const selBodyRef = useRef<(() => void) | null>(null);
  const api = useRef<Api | null>(null);

  const [hud, setHud] = useState<Hud | null>(null);
  const [empty, setEmpty] = useState(true);
  const [count, setCount] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [say, setSay] = useState('');
  const [mode, setModeUi] = useState<ActionId | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [undoable, setUndoable] = useState(0);
  const [working, setWorking] = useState(false);
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const volume = useSyncExternalStore(subscribeSound, getVolume, () => 1);
  const instant = useSyncExternalStore(subscribePrefs, instantEnabled, () => false);

  // the loop reads the latest props without being torn down by them
  const latest = useRef({ engine, active, onCombine, onProcess, onBegin, onInspect, onScenery, instant });
  useEffect(() => { latest.current = { engine, active, onCombine, onProcess, onBegin, onInspect, onScenery, instant }; });
  const latest2 = useRef(onInspect);
  useEffect(() => { latest2.current = onInspect; });
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => { if (active) wakeRef.current(); }, [active]);
  useEffect(() => { wakeRef.current(); }, [instant]);

  useEffect(() => {
    const hostN = hostRef.current, bodiesN_ = bodiesRef.current, stageN = stageRef.current, canvasN = canvasRef.current;
    if (!hostN || !bodiesN_ || !stageN || !canvasN) return;
    const host: HTMLDivElement = hostN, bodiesEl: HTMLDivElement = bodiesN_, stage: HTMLDivElement = stageN, canvas: HTMLCanvasElement = canvasN;
    const g0 = canvas.getContext('2d');
    if (!g0) return;
    const g: CanvasRenderingContext2D = g0;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fx = new Fx(readPalette());
    fx.reduced = mq.matches;
    const onMq = () => { fx.reduced = mq.matches; };
    mq.addEventListener?.('change', onMq);
    // colours follow the theme (light / dark / neon) live
    const themeWatch = new MutationObserver(() => { fx.pal = readPalette(); wake(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    /** Latest impacts between two loose bodies, by pair. A hit counts as an attempt. */
    const hits = new Map<string, { force: number; speed: number }>();
    /** How much help each pair has earned, so a pair that was hard gets kinder. */
    const assist = new Map<string, number>();
    const undo = new UndoStack();
    let session: CraftSession | null = null;
    let sessionKey = '';
    let sessionTime = 0;
    let resolving: { bs: Body[]; ids: string[]; t: number; dur: number; tier: Tier; a0: number; d0: number; dust: number } | null = null;
    let pull: { a: Body; b: Body; t: number } | null = null;
    let cool = 0;
    let sel: Body | null = null;
    let shown: Body | null = null;
    /** A press that began on bare scenery — it becomes a scenery click only if it stays a click. */
    let bgTap: { x: number; y: number; t: number; id: number } | null = null;
    let hover: Body | null = null;
    let lastTap: { body: Body; at: number } | null = null;
    let drag: { body: Body; t0: number; x0: number; y0: number; moved: boolean; lx: number; ly: number; lt: number; vx: number; vy: number } | null = null;
    let zoom = 1;
    let raf = 0;
    let last = 0;
    let cueTimer = 0;
    let noteTimer = 0;
    let saveTimer = 0;
    let stuckShown = false;
    let bodiesN = -1;
    let restored = false;
    let dirty = false;

    /* the hand */
    let mode: ActionId | null = null;
    const ptr = { x: 0, y: 0, inside: false, down: false, vx: 0, vy: 0, lt: 0, touch: false };
    let act: { g: Gesture; b: Body; struckAt: number; lastDust: number } | null = null;
    let demo: { b: Body; t: number; action: ActionId } | null = null;
    let handA = 0;
    let actCool = 0;
    let workFails = 0;
    let longPress: { b: Body; x: number; y: number; timer: number } | null = null;
    const feel = new Set<Body>();
    const clusterAge = new Map<string, number>();
    const clusterDone = new Set<string>();

    const say_ = (text: string, tone: Note['tone'] = 'info', sub?: string, ms = 5200) => {
      setNote({ key: performance.now(), text, sub, tone });
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(() => setNote(null), ms);
    };

    const world = new World(bodiesEl, {
      resolve: id => {
        const n = latest.current.engine.get(id);
        return n ? { id: n.id, n: n.n, vis: n.vis, cat: n.cat, era: n.era, no: n.no } : null;
      },
      onImpact: info => {
        const { a, b, speed, force } = info;
        if (a.temp || b.temp || session) return;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.max(a.z, b.z);
        const hard = a.props.hard >= b.props.hard ? a : b;
        fx.sound(hard.props.sound, { vol: clamp(0.22 + force * 1.1, 0.2, 1) });
        fx.burst(mx, my, { n: 3 + Math.round(clamp(force, 0, 1) * 8), color: hard.props.dust, speed: 50 + speed * 0.12, life: 0.4 });
        if (a.props.hard + b.props.hard > 1.1 && speed > 220) fx.spark(mx, my, { n: 4, color: 'ochre' });
        fx.shake(Math.min(2.4, force * 3));
        hits.set(world.pairKeyOf(a, b), { force, speed });
        wake();
      },
      onWall: (b, speed) => { if (!session && speed > 140) fx.sound('thud', { vol: clamp(speed / 900, 0.08, 0.45), rate: 1.1 - b.mass * 0.05 }); },
      onLand: (_b, speed) => { if (!session && speed > 160) fx.sound('thud', { vol: clamp(speed / 1600, 0.06, 0.4), rate: 1.3 }); },
      onZone: () => {},
      onKnockOut: (b, vx, vy) => { sendHome(b, 'knock', { x: vx, y: vy }); },
      onEvict: b => { sendHome(b, 'quick'); },
    });

    /* ── geometry ─────────────────────────────────────────────────── */

    const layoutZones = () => {
      const zr = zonesRef.current;
      if (!zr) return;
      for (const z of ZONES) {
        const el = zr.querySelector<HTMLElement>(`[data-z="${z.id}"]`);
        if (!el) continue;
        const r = world.zoneRect(z.id);
        el.style.left = `${r.x}px`; el.style.top = `${r.y}px`; el.style.width = `${r.w}px`; el.style.height = `${r.h}px`;
      }
      for (const id of ['processing', 'assembly'] as const) {
        const el = zr.querySelector<HTMLElement>(`[data-p="${id}"]`);
        if (!el) continue;
        const p = world.patch(id);
        el.style.left = `${p.cx - p.rx}px`; el.style.top = `${p.cy - p.ry}px`; el.style.width = `${p.rx * 2}px`; el.style.height = `${p.ry * 2}px`;
      }
      const dock = dockRef.current;
      if (dock) {
        const p = world.patch('processing'), a = world.area;
        const w = dock.offsetWidth || 220;
        dock.style.left = `${clamp(p.cx - w / 2, a.x + 6, Math.max(a.x + 6, a.x + a.w - w - 6))}px`;
        let top = Math.min(a.y + a.h - 44, p.cy + p.ry + 10);
        // keep clear of the small tools row when it sits along the same edge (phones)
        const tools = host.querySelector<HTMLElement>('.wb-tools');
        if (tools) {
          const hr = host.getBoundingClientRect(), tr = tools.getBoundingClientRect();
          const tTop = tr.top - hr.top, tBot = tr.bottom - hr.top;
          if (tr.width > 0 && tBot > top - 4 && tTop < top + 48 && tTop > hr.height / 2) top = Math.max(a.y, tTop - 52);
        }
        dock.style.top = `${top}px`;
      }
    };

    /** The scenery is the workspace. Only interface that is actually showing
     *  (the inventory, the foot strip) keeps pieces out from under it. */
    const measurePad = () => {
      const hr = host.getBoundingClientRect();
      if (hr.width < 40 || hr.height < 40) return;
      const pad = { l: 0, t: 0, r: 0, b: 0 };
      document.querySelectorAll<HTMLElement>('[data-wb-avoid]').forEach(el => {
        if (el.dataset.wbAvoid === 'off') return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || getComputedStyle(el).visibility === 'hidden') return;
        const cx = (r.left + r.right) / 2 - hr.left, cy = (r.top + r.bottom) / 2 - hr.top;
        if (r.right < hr.left + 2 || r.left > hr.right - 2 || r.bottom < hr.top + 2 || r.top > hr.bottom - 2) return;
        if (r.width > hr.width * 0.6) {
          if (cy < hr.height / 2) pad.t = Math.max(pad.t, r.bottom - hr.top);
          else pad.b = Math.max(pad.b, hr.bottom - r.top);
        } else if (cx < hr.width / 2) pad.l = Math.max(pad.l, r.right - hr.left);
        else pad.r = Math.max(pad.r, hr.right - r.left);
      });
      const cap = { l: hr.width * 0.4, r: hr.width * 0.4, t: hr.height * 0.35, b: hr.height * 0.5 };
      (Object.keys(pad) as (keyof typeof pad)[]).forEach(k => { pad[k] = Math.min(cap[k], Math.round(pad[k])); });
      if (world.setPad(pad)) { layoutZones(); wake(); }
      // shared with the floating outcome beside the host
      const vars = host.parentElement ?? host;
      vars.style.setProperty('--wb-pl', `${pad.l}px`);
      vars.style.setProperty('--wb-pr', `${pad.r}px`);
      vars.style.setProperty('--wb-pt', `${pad.t}px`);
      vars.style.setProperty('--wb-pb', `${pad.b}px`);
    };
    const onLayout = () => measurePad();
    const onTransEnd = (e: TransitionEvent) => { if ((e.target as HTMLElement | null)?.closest?.('[data-wb-avoid]')) measurePad(); };
    window.addEventListener('evo:layout', onLayout);
    document.addEventListener('transitionend', onTransEnd);

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      world.resize(r.width, r.height);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
      measurePad();
      layoutZones();
      world.paintAll();
      tryRestore();
      wake();
    };
    // ResizeObserver is everywhere that matters; a plain resize listener covers the rest
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(host);
    if (!ro) window.addEventListener('resize', resize);

    /** Viewport point → world point, undoing the bench zoom. */
    const local = (clientX: number, clientY: number) => {
      const r = host.getBoundingClientRect();
      const px = clientX - r.left, py = clientY - r.top;
      return { x: r.width / 2 + (px - r.width / 2) / zoom, y: r.height / 2 + (py - r.height / 2) / zoom };
    };
    /** World point → viewport point. */
    const toViewport = (x: number, y: number) => {
      const r = host.getBoundingClientRect();
      return { x: r.left + world.w / 2 + (x - world.w / 2) * zoom, y: r.top + world.h / 2 + (y - world.h / 2) * zoom };
    };

    /* ── memory & undo ────────────────────────────────────────────── */

    const placed = (): Placed[] => {
      const a = world.area;
      return world.bodies.filter(b => !b.temp && !b.outside)
        .map(b => ({ id: b.itemId, fx: (b.x - a.x) / a.w, fy: (b.y - a.y) / a.h, a: +b.angle.toFixed(3) }));
    };
    const snap = () => { undo.push(placed()); setUndoable(undo.size); dirty = true; };
    const restoreItems = (items: Placed[]) => {
      const eng = latest.current.engine;
      const a = world.area;
      for (const b of [...world.bodies]) if (!b.temp) world.remove(b);
      for (const p of items) {
        if (!eng.holds(p.id)) continue;
        const b = world.spawn(p.id, a.x + p.fx * a.w, a.y + p.fy * a.h, { pop: false, angle: p.a });
        if (b) { b.age = 1; b.targetAngle = p.a; }
      }
      world.paintAll();
    };
    /** Bring back what was lying on the ground when the page was left. Waits for the saved game to load. */
    function tryRestore() {
      if (restored || world.w < 50) return;
      const eng = latest.current.engine;
      if (!eng.resumed) return;
      restored = true;
      const items = loadBench().filter(p => eng.holds(p.id));
      if (items.length && world.bodies.filter(b => !b.temp).length === 0) restoreItems(items);
      wake();
    }
    const flushSave = () => { window.clearTimeout(saveTimer); saveBench(placed()); dirty = false; };
    const onHide = () => { if (world.bodies.length || dirty) flushSave(); };
    window.addEventListener('pagehide', onHide);

    /* ── loop ─────────────────────────────────────────────────────── */

    function wake() {
      if (raf || !latest.current.active) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    wakeRef.current = wake;

    const handWanted = () => !!mode && (ptr.inside && (!ptr.touch || ptr.down) || !!demo);
    const needFrame = () =>
      world.busy || !!session || !!resolving || !!pull || fx.alive || cool > 0 || !!drag || hits.size > 0 || world.touching().length > 0
      || !!act || !!demo || handA > 0.02 || handWanted() || feel.size > 0;

    function frame(now: number) {
      raf = 0;
      if (!latest.current.active) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      render(now);
      if (needFrame()) raf = requestAnimationFrame(frame);
    }

    function step(dt: number) {
      world.step(dt);
      if (cool > 0) cool -= dt;
      if (actCool > 0) actCool -= dt;
      updatePull(dt);
      magnet(dt);
      if (session) updateSession(dt);
      if (resolving) updateResolving(dt);
      updateAct(dt);
      updateDemo(dt);
      if (!session && !resolving && !pull && cool <= 0 && !mode) checkClusters(dt);
      hits.clear();
      fx.update(dt);
      syncChrome();
      if (dirty && !saveTimer) saveTimer = window.setTimeout(() => { saveTimer = 0; flushSave(); }, 700);
    }

    /* ── attraction ────────────────────────────────────────────────────
       A piece carried close to another is drawn toward it if the two belong
       together — a way in, or a step on the way to one — and only nudged
       away if they clearly do not. Both tremble a little near a good match.
       This is a feeling, never a verdict: nothing is combined from here. */
    let nearA: Body | null = null, nearB: Body | null = null;
    function setNear(a: Body | null, b: Body | null) {
      if (a === nearA && b === nearB) return;
      nearA?.el.removeAttribute('data-near'); nearB?.el.removeAttribute('data-near');
      nearA = a; nearB = b;
      a?.el.setAttribute('data-near', ''); b?.el.setAttribute('data-near', '');
    }
    function magnet(dt: number) {
      const held = drag?.body;
      if (!held || mode || session || resolving || pull || !world.bodies.includes(held)) { setNear(null, null); return; }
      const eng = latest.current.engine;
      let best: Body | null = null, bestScore = 0, bestPull = 'none';
      for (const o of world.bodies) {
        if (o === held || o.temp || o.locked || o.held || o.outside) continue;
        const d = Math.hypot(o.x - held.x, o.y - held.y);
        const reach = (held.r + o.r) * 1.7;
        if (d > reach) continue;
        const pr = eng.probe([held.itemId, o.itemId]).pull;
        const w = pr === 'exact' ? 1.6 : pr === 'unstable' ? 1.3 : pr === 'attract' ? 1 : 0.25;
        const score = w * (1 - d / reach);
        if (score > bestScore) { bestScore = score; best = o; bestPull = pr; }
      }
      if (!best) { setNear(null, null); return; }
      const bd = Math.hypot(best.x - held.x, best.y - held.y) || 1;
      const reach = (held.r + best.r) * 1.7, touch = (held.r + best.r) * 0.95;
      const inAssembly = world.inPatch(best, 'assembly');
      if (bestPull === 'none') {
        // clearly unrelated: no pull, a faint shy step back when pressed right against it
        setNear(null, null);
        if (bd < touch * 1.05) {
          best.vx += ((best.x - held.x) / bd) * 30 * dt;
          best.vy += ((best.y - held.y) / bd) * 30 * dt;
        }
        return;
      }
      setNear(held, best);
      if (bd > touch) {
        const strength = (bestPull === 'exact' ? 1.5 : bestPull === 'unstable' ? 1.25 : 1) * (inAssembly ? 1.5 : 1);
        const k = (1 - (bd - touch) / (reach - touch)) * 90 * strength * dt;
        best.vx += ((held.x - best.x) / bd) * k;
        best.vy += ((held.y - best.y) / bd) * k;
      }
    }

    /* ── assembly ─────────────────────────────────────────────────────
       Touching bodies form clusters. A pair is answered as soon as it meets
       (as it always was); three or more wait until the last piece has been
       let go and has settled. */

    function clusters(): Cluster[] {
      const ok = (b: Body) => !b.temp && !b.locked && !b.outside && b.solid;
      const parent = new Map<Body, Body>();
      const find = (x: Body): Body => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!; return r; };
      for (const p of world.touching(true)) {
        if (!ok(p.a) || !ok(p.b)) continue;
        if (!parent.has(p.a)) parent.set(p.a, p.a);
        if (!parent.has(p.b)) parent.set(p.b, p.b);
        const ra = find(p.a), rb = find(p.b);
        if (ra !== rb) parent.set(ra, rb);
      }
      const groups = new Map<Body, Body[]>();
      for (const b of parent.keys()) {
        const r = find(b);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r)!.push(b);
      }
      return [...groups.values()].filter(c => c.length >= 2 && c.length <= 5);
    }

    function checkClusters(dt: number) {
      const eng = latest.current.engine;
      const seen = new Set<string>();
      const wobble = new Set<Body>();
      for (const c of clusters()) {
        const sig = sigOf(c);
        seen.add(sig);
        if (clusterDone.has(sig)) {
          // held together on the way to something: it trembles, more the closer it is
          const info = eng.probe(c.map(b => b.itemId));
          for (const b of c) {
            wobble.add(b);
            b.el.setAttribute(info.pull === 'unstable' ? 'data-unstable' : 'data-hold', '');
            b.el.removeAttribute(info.pull === 'unstable' ? 'data-hold' : 'data-unstable');
          }
          continue;
        }
        const age = (clusterAge.get(sig) ?? 0) + dt;
        clusterAge.set(sig, age);
        if (c.some(b => b.locked)) continue;
        if (c.length === 2) {
          const hit = hits.get(world.pairKeyOf(c[0], c[1]));
          if (hit || age > 0.22) { evaluate(c, sig); return; }
        } else if (age > 0.5 && !c.some(b => b.held)) { evaluate(c, sig); return; }
      }
      for (const k of [...clusterAge.keys()]) if (!seen.has(k)) clusterAge.delete(k);
      for (const k of [...clusterDone]) if (!seen.has(k)) clusterDone.delete(k);
      for (const b of feel) if (!wobble.has(b)) { b.el.removeAttribute('data-unstable'); b.el.removeAttribute('data-hold'); }
      feel.clear();
      wobble.forEach(b => feel.add(b));
    }

    /** The pieces have met. The game decides whether this is a recipe, a step toward one, or nothing. */
    function evaluate(c: Cluster, sig: string) {
      const eng = latest.current.engine;
      const ids = c.map(b => b.itemId);
      clusterDone.add(sig);
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) world.latch(world.pairKeyOf(c[i], c[j]));
      if (drag && c.includes(drag.body)) { world.release(drag.body, 0, 0); drag = null; }
      if (ids.some(i => !eng.holds(i))) { prune(); return; }
      const rid = eng.recipeOf(ids);
      const node = rid ? eng.get(rid) : undefined;
      const tooEarly = !!node && !eng.has(node.id) && !eng.isRecipeUnlocked(node.id);
      if (rid && node && !tooEarly) {
        const known = eng.hasRouteOf(rid, ids) || latest.current.instant;
        const eraIndex = Math.max(0, eng.db.eras.findIndex(e => e.id === node.era));
        let tier: Tier;
        if (c.length === 2) {
          const A = eng.get(ids[0])!, B = eng.get(ids[1])!;
          tier = deriveSpec(A, B, node, { eraIndex, relax: eng.has(rid) }).tier;
        } else tier = tierOf(node, eraIndex);
        if (known) { beginResolve(c, 'quick', latest.current.instant ? 0.26 : 0.46); return; }
        // the hands-on process is kept for milestones made from a pair
        if (c.length === 2 && tier === 'major') { startSession(c[0], c[1], rid, pairId(ids[0], ids[1])); return; }
        beginResolve(c, tier === 'major' ? 'major' : 'medium', tier === 'major' ? 2.2 : 0.75 + c.length * 0.12);
        return;
      }
      // not a recipe. If it is on the road to one, it holds — nothing is asked of the engine, nothing is spent.
      if (!tooEarly) {
        const info = eng.assess(ids);
        if (info.kind === 'incomplete') {
          const pr = eng.probe(ids);
          fx.sound('tick', { vol: 0.3, rate: 1.6 });
          say_(info.message, 'good', pr.pull === 'unstable' ? 'So close it is trembling.' : undefined);
          wake();
          return;
        }
      }
      answerNow(c);
    }

    /** A set that makes nothing, or is too early: the engine says so, the bodies refuse. */
    function answerNow(c: Cluster) {
      const eng = latest.current.engine;
      latest.current.onBegin();
      const res = latest.current.onCombine(c.map(b => b.itemId));
      if (res.status === 'error') { for (const b of c) world.remove(b, true); return; }
      if (res.status === 'new' || res.status === 'known') { finishWith(c, res); return; }
      // a refusal: they shove apart, dull and short
      const mx = c.reduce((s, b) => s + b.x, 0) / c.length, my = c.reduce((s, b) => s + b.y, 0) / c.length;
      if (c.length === 2) world.repel(c[0], c[1], 320);
      else for (const b of c) { const dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy) || 1; b.vx += (dx / d) * 230 / b.mass; b.vy += (dy / d) * 230 / b.mass; b.q = Math.max(b.q, 0.16); }
      fx.sound(res.status === 'tier_locked' ? 'chime' : 'tick', { vol: 0.5, rate: res.status === 'tier_locked' ? 0.7 : 0.8 });
      fx.shake(res.status === 'tier_locked' ? 1 : 2.4);
      fx.burst(mx, my, { n: 5, color: 'bone3', speed: 40, life: 0.3 });
      cool = 0.35;
      if (res.status === 'tier_locked') say_(res.message, 'warn');
      else {
        const f = res as Extract<CombineResult, { status: 'fail' }>;
        const near = f.nudge ? null : (f.items.length === 2 ? nearLine(eng, f.a.id, f.b.id) : null);
        say_(f.message, f.info.kind === 'irrelevant' || f.info.kind === 'wrong_state' || f.info.kind === 'needs_processing' ? 'good' : 'info',
          f.nudge ?? near?.text ?? undefined);
      }
      wake();
    }

    function beginResolve(bs: Body[], tier: Tier, dur: number) {
      latest.current.onBegin();
      snap();
      const mx = bs.reduce((s, b) => s + b.x, 0) / bs.length, my = bs.reduce((s, b) => s + b.y, 0) / bs.length;
      const d0 = bs.reduce((s, b) => s + Math.hypot(b.x - mx, b.y - my), 0) / bs.length * 2;
      resolving = {
        bs, ids: bs.map(b => b.itemId), t: 0, dur, tier, a0: Math.atan2(bs[0].y - my, bs[0].x - mx), d0: Math.max(d0, bs[0].r * 1.8), dust: 0,
      };
      // the rest of the bench dims while the pieces work on each other
      if (tier !== 'quick') { host.dataset.resolve = tier; for (const b of bs) b.el.dataset.res = ''; }
      for (const b of bs) { b.locked = true; b.grabbable = false; }
      if (drag && bs.includes(drag.body)) { world.release(drag.body, 0, 0); drag = null; }
      wake();
    }

    function updateResolving(dt: number) {
      const r = resolving;
      if (!r) return;
      r.t += dt;
      const { bs } = r;
      const n = bs.length;
      const mx = bs.reduce((s, b) => s + b.x, 0) / n, my = bs.reduce((s, b) => s + b.y, 0) / n;
      const k = clamp(r.t / r.dur, 0, 1);
      const r0 = bs[0].r;
      for (const b of bs) { b.z += (0 - b.z) * Math.min(1, dt * 12); b.glow = r.tier === 'major' ? k : k * 0.5; }
      if (r.tier === 'quick') {
        // a known way: the pieces simply draw together
        for (const b of bs) world.glide(b, mx, my, 10 + k * 14);
      } else {
        // they circle each other, closing in as the work nears its end
        const turns = r.tier === 'major' ? 1.6 : 0.9;
        const ang = r.a0 + easeInOut(k) * Math.PI * 2 * turns;
        const rad = Math.max(r0 * 0.35, (r.d0 / 2) * (1 - k * k * 0.85));
        bs.forEach((b, i) => {
          const a = ang + (i / n) * Math.PI * 2;
          world.glide(b, mx + Math.cos(a) * rad, my + Math.sin(a) * rad, 16);
        });
        r.dust += dt;
        if (r.dust > (r.tier === 'major' ? 0.05 : 0.09)) {
          r.dust = 0;
          const th = Math.random() * Math.PI * 2, dd = r0 * (1.8 + Math.random());
          fx.burst(mx + Math.cos(th) * dd, my + Math.sin(th) * dd, { n: 1, color: 'bone3', speed: 0, life: 0.5, size: 1.6, drag: 0 });
        }
        if (r.tier === 'major') { fx.shake(k * 1.2); if (r.t > 0.3 && Math.random() < dt * 5) fx.ring(mx, my, r0 * (1.3 + k * 1.4), { color: 'ochre', life: 0.7 }); }
      }
      if (r.t >= r.dur) {
        resolving = null;
        clearResolveMark(bs);
        for (const b of bs) b.glow = 0;
        const res = latest.current.onCombine(r.ids);
        if (res.status === 'error') { for (const b of bs) world.remove(b, true); return; }
        if (res.status === 'new' || res.status === 'known') { finishWith(bs, res, r.tier); return; }
        // the answer changed under us: put them down and let them part
        for (const b of bs) { b.locked = false; b.grabbable = true; }
        if (bs.length === 2) world.repel(bs[0], bs[1], 300);
        fx.sound('tick', { vol: 0.5 }); cool = 0.4;
      }
    }

    function clearResolveMark(bs: Body[]) {
      delete host.dataset.resolve;
      for (const b of bs) b.el.removeAttribute('data-res');
    }

    /** The engine said yes: the pieces become one, and the result stays on the ground. */
    function finishWith(bs: Body[], res: Extract<CombineResult, { status: 'new' | 'known' }>, tier: Tier = 'quick') {
      const mx = bs.reduce((s, b) => s + b.x, 0) / bs.length, my = bs.reduce((s, b) => s + b.y, 0) / bs.length;
      for (const b of bs) { b.el.removeAttribute('data-unstable'); b.el.removeAttribute('data-hold'); world.remove(b, true); }
      const nb = world.spawn(res.node.id, mx, my, { pop: true, angle: 0 });
      if (nb) { nb.q = 0.3; nb.angle = 0; nb.targetAngle = 0; }
      const fresh = res.status === 'new';
      fx.ring(mx, my, world.unit * (fresh ? 2.6 : 1.8), { color: 'ochre', life: fresh ? 0.8 : 0.5, width: fresh ? 2 : 1.4 });
      fx.burst(mx, my, { n: fresh ? 16 : 8, color: 'ochre', speed: fresh ? 150 : 90, life: 0.6, size: 2.4 });
      fx.sound(fresh ? 'chime' : 'pop', { vol: fresh ? 0.9 : 0.6 });
      if (fresh && tier !== 'quick') { fx.shake(tier === 'major' ? 4 : 2); fx.spark(mx, my, { n: tier === 'major' ? 14 : 8, color: 'ochre', speed: 200, life: 0.5 }); }
      if (fresh && tier === 'major') fx.flash(0.9);
      if (res.unlocked.length) say_(`${res.unlocked.map(u => u.n).join(', ')} appears.`, 'good', latest.current.engine.unlockNote(res.unlocked[0].id) ?? undefined);
      lastTap = null;
      sel = null;
      cool = 0.3;
      dirty = true;
      wake();
    }

    /** After a reset, anything on the bench that is no longer held goes. */
    function prune() {
      const eng = latest.current.engine;
      let dropped = false;
      for (const b of [...world.bodies]) {
        if (b.temp) continue;
        if (!eng.holds(b.itemId)) { if (session && (session.a === b || session.b === b)) { session.cancel(); endSession(false); } world.remove(b, true); dropped = true; }
      }
      if (dropped) { sel = null; lastTap = null; pull = null; resolving = null; act = null; delete host.dataset.resolve; undo.clear(); setUndoable(0); dirty = true; wake(); }
    }
    const unsub = engine.subscribe(() => { prune(); tryRestore(); });

    /* ── sessions (milestones made from a pair) ───────────────────── */

    function startSession(a: Body, b: Body, rid: string, key: string) {
      const eng = latest.current.engine;
      const A = eng.get(a.itemId), B = eng.get(b.itemId), R = eng.get(rid);
      if (!A || !B || !R) return;
      latest.current.onBegin();
      snap();
      const eraIndex = Math.max(0, eng.db.eras.findIndex(e => e.id === R.era));
      const spec = deriveSpec(A, B, R, { eraIndex, relax: eng.has(rid) });
      fx.pal = readPalette();
      if (pull) { pull.a.locked = pull.b.locked = false; pull = null; }
      sel = null; lastTap = null;
      sessionKey = key; sessionTime = 0; stuckShown = false;
      setStuck(false);
      session = new CraftSession({
        world, fx, a, b, spec, pal: fx.pal, reduced: mq.matches,
        assist: assist.get(key) ?? 0, seed: hashStr(key),
        onStep: (i, total, verb, kind) => {
          const seen = seenSteps()[kind] ?? 0;
          const cue = seen < CUE_LIMIT;
          setHud({ i, total, verb, kind, hint: stepHint(kind), cue });
          setSay(`${verb}. ${stepHint(kind)}`);
          window.clearTimeout(cueTimer);
          if (cue) cueTimer = window.setTimeout(() => { markStepSeen(kind); setHud(h => (h ? { ...h, cue: false } : h)); }, 3400);
        },
        onSay: setSay,
      });
      host.dataset.tier = spec.tier;
      wake();
    }

    function endSession(done: boolean) {
      const s = session;
      if (!s) return;
      session = null;
      window.clearTimeout(cueTimer);
      assist.set(sessionKey, done ? s.assist * 0.4 : s.assist);
      world.zones.clear();
      setHud(null); setStuck(false);
      delete host.dataset.tier;
      if (done) beginResolve([s.a, s.b], s.spec.tier, latest.current.instant ? 0.3 : s.spec.tier === 'major' ? 2.4 : 1.1);
      else {
        world.repel(s.a, s.b, 240);
        cool = 0.7;
      }
    }

    function updateSession(dt: number) {
      const s = session;
      if (!s) return;
      sessionTime += dt;
      s.update(dt);
      if (s.done) { endSession(true); return; }
      if (!stuckShown && sessionTime > 22) { stuckShown = true; setStuck(true); }
    }

    /* ── tap-to-pair ──────────────────────────────────────────────── */

    function startPull(a: Body, b: Body) {
      if (session || resolving) return;
      pull = { a, b, t: 0 };
      a.locked = b.locked = true;
      sel = null;
      wake();
    }
    function updatePull(dt: number) {
      const p = pull;
      if (!p) return;
      p.t += dt;
      const { a, b } = p;
      if (!world.bodies.includes(a) || !world.bodies.includes(b)) { pull = null; return; }
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const want = (a.r + b.r) * 0.8;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      world.glide(a, mx - nx * want * 0.5, my - ny * want * 0.5, 9);
      world.glide(b, mx + nx * want * 0.5, my + ny * want * 0.5, 9);
      a.z += (0 - a.z) * Math.min(1, dt * 10); b.z += (0 - b.z) * Math.min(1, dt * 10);
      if (d <= want * 1.04 || p.t > 0.9) {
        a.locked = b.locked = false;
        pull = null;
        world.unlatchAll();
        hits.set(world.pairKeyOf(a, b), { force: 0.12, speed: 160 });
        fx.sound('click', { vol: 0.4 });
      }
    }

    /* ── putting a piece away ─────────────────────────────────────────
       Nothing is ever deleted. The piece flies to its place in the
       inventory, quickly when the player sent it, with the momentum of
       the blow when it was knocked out. */

    function sendHome(b: Body, kind: 'quick' | 'knock', v?: { x: number; y: number }) {
      if (!world.bodies.includes(b)) return;
      if (kind === 'quick' && (b.temp || (session && (session.a === b || session.b === b)))) return;
      if (kind === 'quick') snap();
      const pos = toViewport(b.x, b.y - b.z);
      const art = b.el.querySelector('.wb-art')?.innerHTML ?? '';
      const id = b.itemId, size = b.r * 2 * zoom, angle = b.angle;
      if (drag?.body === b) drag = null;
      if (sel === b) sel = null;
      if (hover === b) hover = null;
      if (act?.b === b) act = null;
      if (longPress?.b === b) { window.clearTimeout(longPress.timer); longPress = null; }
      setNear(null, null);
      b.el.removeAttribute('data-unstable'); b.el.removeAttribute('data-hold');
      world.remove(b);
      fx.sound(kind === 'knock' ? 'whoosh' : 'pop', { vol: kind === 'knock' ? 0.45 : 0.28, rate: kind === 'knock' ? 0.9 : 1.5 });
      if (kind === 'knock') fx.shake(1.5);
      flyHome({
        itemId: id, x: pos.x, y: pos.y, size, art, angle,
        vx: (v?.x ?? 0) * zoom, vy: (v?.y ?? 0) * zoom,
        duration: kind === 'knock' ? 720 : 320, reduced: mq.matches,
      });
      dirty = true;
      wake();
    }

    /* ── the hand: working one thing ──────────────────────────────── */

    function setMode(m: ActionId | null) {
      if (session || resolving) return;
      mode = m;
      if (act) act.b.locked = false;
      act = null; demo = null; workFails = 0;
      setNear(null, null);
      setModeUi(m);
      requestAnimationFrame(layoutZones);
      setWorking(false);
      host.dataset.mode = m ?? '';
      if (m) {
        sel = null;
        for (const b of feel) { b.el.removeAttribute('data-unstable'); b.el.removeAttribute('data-hold'); }
        say_(`${ACTIONS[m].label}. ${ACTIONS[m].gesture}, on one thing.`, 'info', ACTIONS[m].blurb, 4200);
        fx.sound('tick', { vol: 0.25, rate: 1.3 });
      }
      wake();
    }

    function nearestBody(x: number, y: number, k: number): Body | null {
      let best: Body | null = null, bd = Infinity;
      for (const b of world.bodies) {
        if (b.temp || b.locked || b.outside) continue;
        const d = Math.hypot(x - b.x, y - (b.y - b.z));
        if (d < b.r * k && d < bd) { best = b; bd = d; }
      }
      return best;
    }

    /** Take hold of a piece with the current hand. */
    function startAct(b: Body, x: number, y: number) {
      if (!mode) return;
      const gst = new Gesture(mode, { x: b.x, y: b.y - b.z, r: b.r, hard: b.props.hard });
      if (!gst.down(x, y)) { showDemo(b); return; }
      if (act && act.b !== b) { act.b.locked = false; act.b.ox = act.b.oy = 0; }
      act = { g: gst, b, struckAt: 0, lastDust: 0 };
      b.locked = true; b.z = 0;
      b.el.setAttribute('data-work', mode);
      setWorking(true);
      if (latest.current.instant) gst.finish();
      wake();
    }

    /** Show what the hand has to do, once, by doing it. */
    function showDemo(b: Body) {
      if (!mode || demo) return;
      demo = { b, t: 0, action: mode };
      say_(`${ACTIONS[mode].gesture}.`, 'info', ACTIONS[mode].blurb, 3600);
      wake();
    }

    /** A line is drawn through whatever it crosses: if the piece the stroke began beside is not the one
     *  it is heading through, the work moves to the piece it does cross. */
    function retargetCut() {
      const a = act;
      if (!a || a.g.action !== 'cut' || a.g.done || !a.g.cut) return;
      const { x0, y0, x1, y1 } = a.g.cut;
      if (Math.hypot(x1 - x0, y1 - y0) < 26) return;
      const dOf = (q: Body) => segDist(q.x, q.y - q.z, x0, y0, x1, y1);
      if (dOf(a.b) <= a.b.r * 0.75) return;
      let best: Body | null = null, bd = Infinity;
      for (const q of world.bodies) {
        if (q === a.b || q.temp || q.outside || q.locked) continue;
        const d = dOf(q);
        if (d < q.r * 0.5 && d < bd) { best = q; bd = d; }
      }
      if (!best) return;
      const ng = new Gesture('cut', { x: best.x, y: best.y - best.z, r: best.r, hard: best.props.hard });
      if (!ng.down(x0, y0)) { ng.pressed = true; ng.cut = { x0, y0, x1: x0, y1: y0 }; }
      ng.move(x1, y1);
      a.b.el.removeAttribute('data-work'); a.b.locked = false; a.b.ox = a.b.oy = 0;
      best.locked = true; best.z = 0; best.el.setAttribute('data-work', 'cut');
      act = { g: ng, b: best, struckAt: 0, lastDust: 0 };
    }

    function endAct(unlock = true) {
      if (!act) return;
      const { b } = act;
      b.el.removeAttribute('data-work');
      if (unlock) { b.locked = false; b.ox = b.oy = 0; }
      act = null;
      setWorking(false);
    }

    function updateAct(dt: number) {
      const a = act;
      if (!a) return;
      const { g: gst, b } = a;
      if (!world.bodies.includes(b)) { act = null; setWorking(false); return; }
      gst.tick(dt);
      gst.t.x = b.x; gst.t.y = b.y - b.z;
      const act_ = gst.action;
      const now = performance.now();
      if (act_ === 'brush') {
        b.ox = Math.sin(now / 38) * 1.4 * gst.prog;
        if (ptr.down && gst.pressed && now - a.lastDust > 70 && gst.prog > 0.02) {
          a.lastDust = now;
          fx.burst(ptr.x, ptr.y, { n: 1, color: b.props.dust, speed: 26, life: 0.45, size: 1.6 });
          if (now - a.struckAt > 220) { a.struckAt = now; fx.sound('rustle', { vol: 0.16, rate: 1 + gst.prog * 0.4 }); }
        }
      } else if (act_ === 'smash') {
        const n = gst.takeStrikes();
        if (n) {
          b.q = 0.34; b.qv = 0;
          b.ox = (Math.random() - 0.5) * 6; b.oy = 2 + Math.random() * 3;
          fx.sound(b.props.sound, { vol: 0.85, rate: 0.9 + gst.prog * 0.3 });
          fx.shake(2.2 + gst.prog * 2);
          fx.burst(b.x, b.y - b.z, { n: 6 + Math.round(gst.prog * 6), color: b.props.dust, speed: 120, life: 0.45, size: 2 });
          if (b.props.hard > 0.6) fx.spark(b.x, b.y - b.z, { n: 4, color: 'ochre', speed: 160, life: 0.3 });
          b.glow = Math.max(b.glow, 0.5);
        }
        b.glow *= 0.94;
      } else if (act_ === 'cut') {
        b.ox *= 0.9;
        if (gst.pressed && gst.prog > 0.05 && now - a.struckAt > 150) { a.struckAt = now; fx.sound('scrape', { vol: 0.2, rate: 1 + gst.prog * 0.6 }); }
      } else if (act_ === 'separate') {
        b.ox = gst.pull.x * 0.5; b.oy = gst.pull.y * 0.5;
        if (gst.pressed && gst.prog > 0.1 && now - a.struckAt > 200) { a.struckAt = now; fx.sound('scrape', { vol: 0.15, rate: 0.7 + gst.prog * 0.5 }); }
      } else if (act_ === 'dig') {
        b.oy = gst.dip * b.r * 0.22;
        if (gst.dip > 0.95 && now - a.struckAt > 260) {
          a.struckAt = now;
          fx.burst(b.x, b.y - b.z + b.r * 0.4, { n: 4, color: 'ochre', speed: 90, life: 0.5, size: 1.8 });
          fx.sound('puff', { vol: 0.3 });
        }
      }
      if (gst.done) { const body = b; const action = gst.action; endAct(false); body.locked = false; body.ox = body.oy = 0; finishWork(body, action); return; }
      if (!gst.pressed && gst.prog <= 0 && act_ !== 'smash') endAct();
      else if (act_ === 'smash' && gst.prog <= 0 && !gst.pressed) endAct();
    }

    /** The gesture is complete: ask the game what this made. */
    function finishWork(b: Body, action: ActionId) {
      const eng = latest.current.engine;
      if (!eng.holds(b.itemId)) { prune(); return; }
      snap();
      latest.current.onBegin();
      actCool = 0.4;
      const res = latest.current.onProcess(b.itemId, action);
      const bx = b.x, by = b.y - b.z;
      if (res.status === 'error') return;
      if (res.status === 'nothing') {
        workFails++;
        b.q = 0.2; b.av += (Math.random() - 0.5) * 5;
        fx.sound(res.reason === 'tool' ? 'tick' : 'thud', { vol: 0.4, rate: 0.75 });
        fx.burst(bx, by, { n: 4, color: 'bone3', speed: 40, life: 0.3 });
        say_(res.message, res.reason === 'tool' ? 'warn' : 'info', res.note ?? (workFails >= 3 ? 'Not every hand suits every thing. Try another hand — or another thing.' : undefined));
        wake();
        return;
      }
      if (res.status === 'tier_locked') {
        fx.sound('chime', { vol: 0.5, rate: 0.7 });
        say_(res.message, 'warn');
        wake();
        return;
      }
      workFails = 0;
      // what came of it steps out beside what it came from; the source stays: nothing is used up
      const n = res.outputs.length;
      const spread = Math.min(1.9, 0.9 + n * 0.3);
      res.outputs.forEach((o, i) => {
        const dir = n === 1 ? (bx > world.w / 2 ? -1 : 1) * 0.5 * Math.PI : ((i + 0.5) / n - 0.5) * spread * Math.PI + (bx > world.w / 2 ? Math.PI : 0);
        const dist = b.r * 2.3;
        const ob = world.spawn(o.id, bx + Math.cos(dir) * dist, by + Math.sin(dir) * dist * 0.7, { pop: true, z: 46, vx: Math.cos(dir) * 60, vy: Math.sin(dir) * 40 });
        if (ob) ob.q = 0.2;
      });
      const isNew = res.discoveries.some(d => d.status === 'new') || res.fresh.length > 0;
      fx.ring(bx, by, world.unit * (isNew ? 2.3 : 1.6), { color: 'ochre', life: isNew ? 0.7 : 0.45, width: isNew ? 2 : 1.4 });
      fx.burst(bx, by, { n: isNew ? 14 : 8, color: b.props.dust, speed: isNew ? 140 : 90, life: 0.55, size: 2.2 });
      fx.sound(isNew ? 'chime' : 'pop', { vol: isNew ? 0.7 : 0.5 });
      if (res.discoveries.some(d => d.status === 'new')) fx.shake(2);
      const sub = res.unlocked.length ? `${res.unlocked.map(u => u.n).join(', ')} appears.` : undefined;
      say_(res.message, 'good', sub);
      dirty = true;
      wake();
    }

    function updateDemo(dt: number) {
      const d = demo;
      if (!d) return;
      d.t += dt;
      if (d.t > 1.5 || !world.bodies.includes(d.b) || mode !== d.action) { demo = null; return; }
    }

    /** Where the hand is and what it is doing this frame. */
    function handFrame(now: number) {
      const wants = handWanted();
      handA += ((wants ? 1 : 0) - handA) * Math.min(1, 0.25);
      if (handA < 0.02 || !mode) return null;
      let x = ptr.x, y = ptr.y, progress = act?.g.prog ?? 0, press = !!(act?.g.pressed && ptr.down);
      if (demo) {
        const b = demo.b, k = demo.t / 1.5;
        const r = b.r;
        press = true; progress = Math.min(0.75, k * 0.8);
        x = b.x; y = b.y - b.z;
        if (mode === 'brush') x += Math.sin(k * Math.PI * 6) * r * 0.75;
        else if (mode === 'cut') { x += (k - 0.5) * r * 2.6; }
        else if (mode === 'separate') { x += k * r * 1.1; y -= k * r * 0.5; }
        else if (mode === 'dig') { y += Math.sin(k * Math.PI * 4) * r * 0.4; }
      } else if (ptr.touch) { x -= 22; y -= 30; }
      const scale = clamp(world.unit / 34, 0.75, 1.25) * (ptr.touch ? 1.12 : 1);
      return { action: mode, x, y, t: now / 1000, progress, press, vx: ptr.vx, vy: ptr.vy, scale, alpha: handA };
    }

    /* ── drawing ──────────────────────────────────────────────────── */

    function render(now: number) {
      const dpr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, world.w, world.h);
      g.save();
      world.paintAll();
      // the chosen piece is lit by a soft shadow that follows its outline (CSS), not a ring
      const chosen = sel && world.bodies.includes(sel) && !session ? sel : null;
      if (chosen !== shown) { shown?.el.removeAttribute('data-sel'); chosen?.el.setAttribute('data-sel', ''); shown = chosen; }
      const bar = selRef.current;
      if (bar) {
        if (chosen) {
          const cx = world.w / 2, cy = world.h / 2;
          const sx = cx + (chosen.x - cx) * zoom, sy = cy + (chosen.y - chosen.z - cy) * zoom;
          const top = sy - chosen.r * zoom - 10;
          const y = top < 34 ? sy + chosen.r * zoom + 34 : top;
          const x = clamp(sx, 70, Math.max(70, world.w - 70));
          bar.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          if (selIdRef.current !== chosen.itemId) selIdRef.current = chosen.itemId;
          selBodyRef.current = () => sendHome(chosen, 'quick');
          if (bar.hidden) bar.hidden = false;
        } else if (!bar.hidden) { bar.hidden = true; selIdRef.current = null; selBodyRef.current = null; }
      }
      g.globalAlpha = 1;
      session?.draw(g);
      drawWork();
      fx.draw(g, world.w, world.h);
      const hs = handFrame(now);
      if (hs) drawHand(g, hs, fx.pal.bone, fx.pal.ink);
      g.restore();
    }

    /** The work in progress: a ring that fills, and the line of a cut. */
    function drawWork() {
      const a = act;
      if (!a) return;
      const { g: gst, b } = a;
      const cx = b.x, cy = b.y - b.z;
      if (gst.prog > 0.01) {
        g.save();
        g.lineWidth = 1.6; g.lineCap = 'round';
        g.strokeStyle = fx.pal.ochre; g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(cx, cy, b.r * 1.08, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * gst.prog);
        g.stroke();
        g.globalAlpha = 0.18; g.strokeStyle = fx.pal.bone; g.beginPath(); g.arc(cx, cy, b.r * 1.08, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      if (gst.action === 'cut' && gst.cut) {
        const c = gst.cut;
        g.save();
        g.strokeStyle = fx.pal.bone; g.lineWidth = 1.4; g.setLineDash([5, 4]); g.globalAlpha = 0.8; g.lineCap = 'round';
        g.beginPath(); g.moveTo(c.x0, c.y0); g.lineTo(c.x1, c.y1); g.stroke();
        g.restore();
      }
      if (gst.action === 'smash' && gst.prog > 0) {
        // cracks grow with every blow
        g.save();
        g.strokeStyle = fx.pal.bone; g.lineWidth = 1.3; g.globalAlpha = 0.85; g.lineJoin = 'round';
        const n = Math.ceil(gst.prog * 3);
        for (let i = 0; i < n; i++) {
          const ang = (hashStr(b.itemId + i) % 628) / 100;
          let x = cx, y = cy;
          g.beginPath(); g.moveTo(x, y);
          for (let s = 1; s <= 4; s++) {
            const a2 = ang + Math.sin(s * 2.7 + i) * 0.5;
            x += Math.cos(a2) * b.r * 0.3; y += Math.sin(a2) * b.r * 0.3;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.restore();
      }
    }

    /** DOM that follows state but is not the canvas: zones, zoom, shake, progress, counts. */
    function syncChrome() {
      const zr = zonesRef.current;
      if (zr) {
        for (const el of Array.from(zr.children) as HTMLElement[]) {
          if (el.dataset.z) {
            const id = el.dataset.z as ZoneId;
            el.classList.toggle('on', world.zones.has(id));
            el.classList.toggle('lit', session?.lit === id);
          }
        }
        const pp = zr.querySelector<HTMLElement>('[data-p="processing"]');
        const pa = zr.querySelector<HTMLElement>('[data-p="assembly"]');
        pp?.classList.toggle('lit', !!mode);
        pa?.classList.toggle('lit', !mode && (feel.size > 0 || !!drag));
      }
      stage.style.transform = `translate3d(${fx.shakeX.toFixed(2)}px, ${fx.shakeY.toFixed(2)}px, 0) scale(${zoom})`;
      const p = progRef.current;
      if (p) p.style.transform = `scaleX(${session ? session.progress : 0})`;
      const n = world.bodies.filter(b => !b.temp).length;
      if (n !== bodiesN) { bodiesN = n; setEmpty(n === 0); setCount(n); dirty = true; }
      // a hand held over a piece it can work makes that piece lean toward it
      if (mode && ptr.inside && !act && !session && !resolving) {
        const b = world.bodyAt(ptr.x, ptr.y, q => !q.locked);
        const ready = b && latest.current.engine.proc?.byFrom.get(b.itemId)?.some(t => t.action === mode);
        if (b && ready) {
          if (!b.el.hasAttribute('data-eager')) b.el.setAttribute('data-eager', '');
          b.glow += (0.32 - b.glow) * 0.15;
        }
        for (const o of world.bodies) if (o !== b && o.el.hasAttribute('data-eager')) { o.el.removeAttribute('data-eager'); o.glow = 0; }
      } else {
        for (const o of world.bodies) if (o.el.hasAttribute('data-eager')) { o.el.removeAttribute('data-eager'); o.glow = 0; }
      }
    }

    /* ── input ────────────────────────────────────────────────────── */

    const track = (e: PointerEvent) => {
      const p = local(e.clientX, e.clientY);
      const now = performance.now();
      const dt = Math.max(0.001, (now - ptr.lt) / 1000);
      ptr.vx += ((p.x - ptr.x) / dt - ptr.vx) * 0.4;
      ptr.vy += ((p.y - ptr.y) / dt - ptr.vy) * 0.4;
      if (now - ptr.lt > 120) { ptr.vx = 0; ptr.vy = 0; }
      ptr.x = p.x; ptr.y = p.y; ptr.lt = now; ptr.inside = true; ptr.touch = e.pointerType !== 'mouse';
      return p;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.wb-tools, .wb-hud button, .wb-sel, .wb-dock')) return;
      unlockAudio();
      if (resolving) return;
      const p = track(e);
      ptr.down = true;
      host.setPointerCapture?.(e.pointerId);
      if (session) { session.pointerDown(p.x, p.y, e.pointerType as 'mouse' | 'touch' | 'pen'); wake(); return; }
      if (mode) {
        const b = mode === 'cut' ? (world.bodyAt(p.x, p.y, q => !q.locked) ?? nearestBody(p.x, p.y, 2.4)) : world.bodyAt(p.x, p.y, q => !q.locked || q === act?.b);
        if (b) {
          if (act && act.b === b) { act.g.down(p.x, p.y); if (act.g.pressed) act.b.el.setAttribute('data-work', mode); }
          else if (actCool <= 0) startAct(b, p.x, p.y);
        }
        wake();
        return;
      }
      const b = world.bodyAt(p.x, p.y, q => !q.locked);
      if (!b) {
        // a click that only lets go of a chosen piece belongs to crafting, not to the scenery
        const hadChoice = !!sel || !!pull;
        sel = null;
        if (e.detail >= 2 && zoom !== 1) { zoom = 1; }
        bgTap = hadChoice ? null : { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
        wake();
        return;
      }
      bgTap = null;
      if (pull && (pull.a === b || pull.b === b)) { pull.a.locked = pull.b.locked = false; pull = null; }
      world.grab(b, p.x, p.y);
      drag = { body: b, t0: performance.now(), x0: e.clientX, y0: e.clientY, moved: false, lx: p.x, ly: p.y, lt: performance.now(), vx: 0, vy: 0 };
      fx.sound(b.props.sound, { vol: 0.12, rate: 1.4 });
      world.unlatchAll();
      // a finger held on a piece puts it away, the way a right click does
      if (e.pointerType !== 'mouse') {
        const bb = b;
        longPress = { b: bb, x: e.clientX, y: e.clientY, timer: window.setTimeout(() => {
          if (longPress?.b === bb && drag?.body === bb && !drag.moved) {
            world.release(bb, 0, 0); drag = null; longPress = null;
            try { navigator.vibrate?.(12); } catch { /* not everywhere */ }
            sendHome(bb, 'quick');
          }
        }, 560) };
      }
      wake();
    };

    const onMove = (e: PointerEvent) => {
      const p = track(e);
      if (longPress && Math.hypot(e.clientX - longPress.x, e.clientY - longPress.y) > 9) { window.clearTimeout(longPress.timer); longPress = null; }
      if (session) { session.pointerMove(p.x, p.y); wake(); return; }
      if (mode) {
        if (act) { act.g.move(p.x, p.y); retargetCut(); }
        wake();
        return;
      }
      if (!drag) {
        if (e.pointerType === 'mouse') {
          const h = world.bodyAt(p.x, p.y, q => !q.locked);
          if (h !== hover) { hover = h; host.style.cursor = h ? 'grab' : ''; }
        }
        return;
      }
      const now = performance.now();
      const dt = Math.max(0.001, (now - drag.lt) / 1000);
      drag.vx += ((p.x - drag.lx) / dt - drag.vx) * 0.45;
      drag.vy += ((p.y - drag.ly) / dt - drag.vy) * 0.45;
      drag.lx = p.x; drag.ly = p.y; drag.lt = now;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
      world.dragTo(drag.body, p.x, p.y);
      wake();
    };

    const onUp = (e: PointerEvent) => {
      host.releasePointerCapture?.(e.pointerId);
      ptr.down = false;
      if (longPress) { window.clearTimeout(longPress.timer); longPress = null; }
      if (e.pointerType !== 'mouse') { ptr.inside = handWanted(); }
      if (session) { session.pointerUp(); wake(); return; }
      if (mode) {
        if (act) {
          const before = act.g.prog;
          act.g.up();
          // a press that made no headway teaches instead of failing quietly
          if (before < 0.02 && act.g.action !== 'smash') { const b = act.b; endAct(); showDemo(b); }
        }
        wake();
        return;
      }
      const tap0 = bgTap;
      bgTap = null;
      if (tap0 && e.type === 'pointerup' && e.pointerId === tap0.id && !drag && !resolving
        && performance.now() - tap0.t < 450 && Math.hypot(e.clientX - tap0.x, e.clientY - tap0.y) < 8) {
        latest.current.onScenery?.(e.clientX, e.clientY);
      }
      const d = drag;
      if (!d) return;
      drag = null;
      // a flick that ended a while ago is not a throw
      const fresh = performance.now() - d.lt < 90;
      world.release(d.body, fresh ? d.vx : 0, fresh ? d.vy : 0);
      dirty = true;
      if (!d.moved && performance.now() - d.t0 < 380) tap(d.body);
      wake();
    };

    const onLeave = () => { ptr.inside = false; ptr.down = false; wake(); };

    const onContext = (e: MouseEvent) => {
      // the browser's menu is only kept off a piece; over bare ground it is left alone
      const p = local(e.clientX, e.clientY);
      const b = world.bodyAt(p.x, p.y);
      if (!b || b.temp) return;
      e.preventDefault();
      e.stopPropagation();
      if (session || resolving) return;
      if (drag?.body === b) { world.release(b, 0, 0); drag = null; }
      sendHome(b, 'quick');
    };

    function tap(b: Body) {
      if (sel && sel !== b && world.bodies.includes(sel)) { const a = sel; sel = null; startPull(a, b); return; }
      sel = sel === b ? null : b;
      fx.sound('tick', { vol: 0.25, rate: 1.5 });
    }

    const onWheel = (e: WheelEvent) => {
      if (!latest.current.active) return;
      e.preventDefault();
      if (session) { session.wheel(e.deltaY); wake(); return; }
      const target = drag?.body ?? hover ?? sel;
      if (target) { world.rotate(target, Math.sign(e.deltaY) * Math.min(0.35, Math.abs(e.deltaY) * 0.0024)); wake(); return; }
      zoom = clamp(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 1.6);
      wake();
    };

    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };

    const undoNow = () => {
      if (session || resolving) return;
      const items = undo.pop();
      setUndoable(undo.size);
      if (!items) { say_('Nothing to undo.', 'info', undefined, 2200); return; }
      endAct();
      restoreItems(items);
      sel = null; pull = null; clusterDone.clear(); clusterAge.clear();
      fx.sound('tick', { vol: 0.3, rate: 0.9 });
      dirty = true;
      wake();
    };

    const onKey = (e: KeyboardEvent) => {
      if (!latest.current.active || typing(e.target)) return;
      if (document.querySelector('[aria-modal="true"]:not([hidden])')) return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'Z')) { e.preventDefault(); undoNow(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'Escape' && session) { session.cancel(); endSession(false); wake(); return; }
      if (k === 'Escape' && mode) { setMode(null); return; }
      if (session && (k === ' ' || k === 'e' || k === 'E' || k === 'r' || k === 'R')) {
        e.preventDefault();
        session.keyDown(k, e.shiftKey, e.repeat);
        wake();
        return;
      }
      if (!session && !resolving) {
        const hotkey = ACTION_ORDER.find(a => ACTIONS[a].key === k.toLowerCase());
        if (hotkey) { e.preventDefault(); setMode(mode === hotkey ? null : hotkey); return; }
        if (mode && (k === 'Enter' || k === ' ')) {
          // keyboard and switch users: do the work on the piece you are pointing at or have chosen
          const t = act?.b ?? world.bodyAt(ptr.x, ptr.y) ?? hover ?? sel;
          if (t) { e.preventDefault(); e.stopPropagation(); endAct(); finishWork(t, mode); }
          return;
        }
      }
      if (!session && (k === 'i' || k === 'I')) {
        // Inspect: only ever on purpose, for the piece you are pointing at or have chosen
        const t = hover ?? sel ?? drag?.body;
        if (t) { e.preventDefault(); latest.current.onInspect(t.itemId); }
        return;
      }
      if (!session && (k === 'Delete' || k === 'Backspace')) {
        const t = drag?.body ?? hover ?? sel;
        if (t) { e.preventDefault(); sendHome(t, 'quick'); }
        return;
      }
      if (!session && (k === 'r' || k === 'R')) {
        const t = drag?.body ?? hover ?? sel;
        if (t) { world.rotate(t, e.shiftKey ? -Math.PI / 12 : Math.PI / 12); wake(); }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { session?.keyUp(e.key); };
    const onBlur = () => { session?.clearKeys(); };

    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('contextmenu', onContext);
    host.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);

    /* ── the handle the rest of the app uses ──────────────────────── */

    const freeSpot = (): { x: number; y: number } => {
      // the assembly ground first, spread around its middle; then anywhere free
      const a = world.area, ap = world.patch('assembly');
      const cand: { x: number; y: number }[] = [];
      const xs = [0.5, 0.36, 0.64, 0.24, 0.76, 0.42, 0.58, 0.14, 0.86];
      const ys = [0.5, 0.38, 0.62, 0.3, 0.7];
      for (const fy of ys) for (const fx_ of xs) cand.push({ x: ap.cx + (fx_ - 0.5) * ap.rx * 1.7, y: ap.cy + (fy - 0.5) * ap.ry * 1.6 });
      cand.sort((p, q) => Math.hypot(p.x - ap.cx, p.y - ap.cy) - Math.hypot(q.x - ap.cx, q.y - ap.cy) + (Math.random() - 0.5) * 60);
      for (const fy of ys) for (const fx_ of xs) cand.push({ x: a.x + a.w * fx_, y: a.y + a.h * fy });
      const loose = world.bodies.filter(b => !b.temp);
      for (const c of cand) if (loose.every(b => Math.hypot(b.x - c.x, b.y - c.y) > world.unit * 2.3)) return c;
      return { x: a.x + a.w * (0.3 + Math.random() * 0.4), y: a.y + a.h * (0.4 + Math.random() * 0.3) };
    };

    const spawn = (id: string, o: SpawnOptions = {}): boolean => {
      const eng = latest.current.engine;
      if (!eng.holds(id)) return false;
      if (world.w < 50 || host.getBoundingClientRect().width < 50) return false;
      unlockAudio();
      if (session || resolving) { fx.sound('tick', { vol: 0.3, rate: 0.7 }); return true; }
      let pos: { x: number; y: number };
      if (o.clientX !== undefined && o.clientY !== undefined) pos = local(o.clientX, o.clientY);
      else pos = freeSpot();
      const pairWith = o.tap && lastTap && world.bodies.includes(lastTap.body) && !lastTap.body.held && performance.now() - lastTap.at < 9000
        ? lastTap.body : null;
      if (pairWith) {
        // the second tap lands beside the first and closes the gap on its own
        const side = pairWith.x > world.w / 2 ? -1 : 1;
        pos = { x: pairWith.x + side * world.unit * 2.9, y: pairWith.y + (Math.random() - 0.5) * world.unit * 0.6 };
      }
      const b = world.spawn(id, pos.x, pos.y, { z: 70 + Math.random() * 24, pop: true });
      if (!b) return false;
      b.vx = (Math.random() - 0.5) * 30;
      fx.sound('pop', { vol: 0.35, rate: 0.9 + Math.random() * 0.2 });
      if (pairWith && !mode) { startPull(pairWith, b); lastTap = null; }
      else lastTap = o.tap ? { body: b, at: performance.now() } : null;
      dirty = true;
      wake();
      return true;
    };

    const unregister = registerBench({
      spawn,
      contains: (x, y) => {
        const r = host.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
        // over the inventory or the foot strip is not "on the scenery"
        const hit = document.elementFromPoint(x, y);
        return !hit?.closest('[data-wb-avoid]:not([data-wb-avoid="off"]), .wb-sel');
      },
      element: () => host,
    });

    api.current = {
      clear: () => {
        if (session) { session.cancel(); endSession(false); }
        snap();
        for (const b of [...world.bodies]) sendHome(b, 'quick');
        sel = null; lastTap = null; pull = null; resolving = null; delete host.dataset.resolve; drag = null; hits.clear();
        endAct();
        wake();
      },
      cancel: () => { if (session) { session.cancel(); endSession(false); wake(); } },
      skip: () => { if (session) { session.skip(); wake(); } },
      rotate: () => { if (session) { session.keyDown('r'); session.keyUp('r'); wake(); } },
      setMode,
      undo: undoNow,
      finishWork: () => {
        const t = act?.b ?? demo?.b ?? sel;
        if (mode && t) { endAct(); demo = null; finishWork(t, mode); }
        else say_('Point at a piece first.', 'info', undefined, 2000);
      },
    };

    resize();

    return () => {
      wakeRef.current = () => {};
      api.current = null;
      onHide();
      unregister();
      unsub();
      ro?.disconnect();
      if (!ro) window.removeEventListener('resize', resize);
      themeWatch.disconnect();
      window.removeEventListener('evo:layout', onLayout);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('transitionend', onTransEnd);
      mq.removeEventListener?.('change', onMq);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('contextmenu', onContext);
      host.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      window.clearTimeout(cueTimer);
      window.clearTimeout(noteTimer);
      window.clearTimeout(saveTimer);
      if (longPress) window.clearTimeout(longPress.timer);
      if (raf) cancelAnimationFrame(raf);
      session?.cancel();
      world.clear();
    };
    // the world is built once; props are read through `latest`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotatable = hud?.kind === 'align' || hud?.kind === 'assemble' || hud?.kind === 'stack';
  const pips = hud ? Array.from({ length: hud.total }, (_, i) => i) : [];
  const toggleSound = useCallback(() => { unlockAudio(); setSoundEnabled(!soundEnabled()); if (!soundEnabled()) return; play('tick', { vol: 0.4 }); }, []);

  return (
    <div
      ref={hostRef}
      className="wb"
      data-craft={hud ? 'on' : 'off'}
      data-mode={mode ?? ''}
      role="application"
      aria-label="The scenery is your workbench. Drag two or more things together anywhere to combine them, or choose a hand — Brush, Smash, Cut, Separate or Dig — and work one thing. Press I to read about a piece. Right click puts a piece away."
    >
      <div className="wb-stage" ref={stageRef}>
        <div className="wb-zones" ref={zonesRef} aria-hidden="true">
          {ZONES.map(z => <i key={z.id} className="wb-zone" data-z={z.id} data-label={z.label} />)}
          <i className="wb-patch" data-p="processing" data-label="Work one thing" />
          <i className="wb-patch" data-p="assembly" data-label="Put things together" />
        </div>
        <div className="wb-bodies" ref={bodiesRef} />
        <canvas className="wb-fx" ref={canvasRef} aria-hidden="true" />
      </div>

      {empty && (
        <p className="wb-empty mono" aria-hidden="true">
          Put things on the ground.<br />Bring two or more together — or take up a hand and work one.
        </p>
      )}

      <div className="wb-hud">
        {hud && (
          <>
            <span className="wb-pips" aria-hidden="true">
              {pips.map(i => <i key={i} className={i < hud.i ? 'done' : i === hud.i ? 'now' : ''} />)}
            </span>
            <span className={'wb-cue mono' + (hud.cue ? ' show' : '')}>
              <b>{hud.verb}</b>{hud.cue && hud.hint ? <> · {hud.hint}</> : null}
            </span>
          </>
        )}
      </div>

      {note && !hud && (
        <p key={note.key} className={`wb-note wb-note-${note.tone}`} role="status">
          <span>{note.text}</span>
          {note.sub && <em className="mono">{note.sub}</em>}
        </p>
      )}

      <div className="wb-dock" ref={dockRef} role="toolbar" aria-label="Hands: choose how to work one thing" data-wb-avoid="off">
        {ACTION_ORDER.map(a => (
          <button
            key={a} type="button" className="wb-act" data-a={a}
            aria-pressed={mode === a}
            data-hint={hintAction === a ? '' : undefined}
            title={`${ACTIONS[a].label} (${ACTIONS[a].key.toUpperCase()}) — ${ACTIONS[a].gesture}. ${ACTIONS[a].blurb}`}
            onClick={() => api.current?.setMode(mode === a ? null : a)}
          >
            <HandIcon action={a} />
            <span className="mono">{ACTIONS[a].label}</span>
          </button>
        ))}
        {mode && (
          <button type="button" className="wb-act wb-do mono" onClick={() => api.current?.finishWork()}
            title="Do the work on the piece you are pointing at (Enter)">
            {working ? 'Finish it' : 'Do it for me'}
          </button>
        )}
      </div>

      <div className="wb-sel" ref={selRef} hidden>
        <button type="button" className="wb-inspect mono"
          onClick={() => { const id = selIdRef.current; if (id) latest2.current(id); }}
          aria-label="Inspect: read about this piece">Inspect</button>
        <button type="button" className="wb-inspect mono"
          onClick={() => selBodyRef.current?.()}
          aria-label="Put away: send this piece back to the inventory">Put away</button>
      </div>

      <div className="wb-tools" data-wb-avoid="off">
        {hud && rotatable && (
          <button type="button" className="chip" onClick={() => api.current?.rotate()} aria-label="Rotate the piece (R)">Rotate</button>
        )}
        {hud && stuck && (
          <button type="button" className="chip warm" onClick={() => api.current?.skip()}>Do it for me</button>
        )}
        {hud && (
          <button type="button" className="chip" onClick={() => api.current?.cancel()} aria-label="Let go and stop (Escape)">Let go</button>
        )}
        {!hud && undoable > 0 && (
          <button type="button" className="chip" onClick={() => api.current?.undo()} aria-label="Undo the last change to the ground (Ctrl Z)">Undo</button>
        )}
        {!hud && count > 0 && (
          <button type="button" className="chip" onClick={() => api.current?.clear()} title="Send everything back to the inventory">Clear</button>
        )}
        <button type="button" className="chip" aria-pressed={instant} onClick={() => setInstant(!instant)}
          title="Skip the hands-on part: gestures and pairs complete on contact">Instant</button>
        <button type="button" className="chip" aria-pressed={sound} onClick={toggleSound}
          aria-label={sound ? 'Sound on' : 'Sound off'} title="Material sounds">Sound</button>
        {sound && (
          <input type="range" className="wb-vol" min={0} max={100} step={5} value={Math.round(volume * 100)}
            onChange={e => { unlockAudio(); setVolume(Number(e.target.value) / 100); }}
            aria-label="Volume" title={`Volume ${Math.round(volume * 100)}%`} />
        )}
      </div>

      <div className="wb-prog" aria-hidden="true"><i ref={progRef} /></div>
      <p className="sr" aria-live="polite">{note ? `${note.text} ${note.sub ?? ''}` : say}</p>
    </div>
  );
}
