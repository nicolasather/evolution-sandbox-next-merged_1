'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerBench, type SpawnOptions } from '@/lib/craft/bus';
import { play, setSoundEnabled, soundEnabled, subscribeSound, unlockAudio } from '@/lib/craft/audio';
import { Fx, readPalette } from '@/lib/craft/fx';
import { CUE_LIMIT, instantEnabled, markStepSeen, seenSteps, setInstant, subscribePrefs } from '@/lib/craft/prefs';
import { CraftSession } from '@/lib/craft/session';
import { deriveSpec } from '@/lib/craft/specs';
import { stepHint } from '@/lib/craft/steps';
import type { Body, StepKind, Tier, ZoneId } from '@/lib/craft/types';
import { World } from '@/lib/craft/world';
import type { Engine } from '@/lib/engine';
import type { CombineResult } from '@/lib/types';

/* ============================================================================
   WORKBENCH — the physical bench where discoveries are made.

   Items from the inventory land here as bodies with weight. Drag them, throw
   them, turn them. Bring two together and, if the pair is a real recipe, its
   process begins (a CraftSession); when the hands are done, Engine.combine
   is asked, exactly as it always was, and the answer appears on the bench.

   What this component does NOT do: decide what anything makes, open tiers,
   record routes or hints. All of that stays in lib/engine.ts. A pair the
   game already knows by this route, a pair that makes nothing, and a pair
   that is too early all answer at once; only a genuine new way to a result
   asks for the hands.
   ========================================================================== */

const ZONES: { id: ZoneId; label: string }[] = [
  { id: 'hearth', label: 'Hearth' },
  { id: 'anvil', label: 'Anvil' },
  { id: 'basin', label: 'Basin' },
];

interface Hud { i: number; total: number; verb: string; kind: StepKind; hint: string; cue: boolean }
interface Api { clear(): void; cancel(): void; skip(): void; rotate(): void }

interface Props {
  engine: Engine;
  /** The workspace view is showing. The loop sleeps otherwise. */
  active: boolean;
  /** Ask the game what the pair makes. Returns the engine's answer. */
  onCombine: (a: string, b: string) => CombineResult;
  /** A new attempt begins: the previous outcome gives way. */
  onBegin: () => void;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const pairId = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function Workbench({ engine, active, onCombine, onBegin }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLElement>(null);
  const api = useRef<Api | null>(null);

  const [hud, setHud] = useState<Hud | null>(null);
  const [empty, setEmpty] = useState(true);
  const [count, setCount] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [say, setSay] = useState('');
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const instant = useSyncExternalStore(subscribePrefs, instantEnabled, () => false);

  // the loop reads the latest props without being torn down by them
  const latest = useRef({ engine, active, onCombine, onBegin, instant });
  useEffect(() => { latest.current = { engine, active, onCombine, onBegin, instant }; });
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
    let session: CraftSession | null = null;
    let sessionKey = '';
    let sessionTime = 0;
    let resolving: { a: Body; b: Body; t: number; dur: number; tier: Tier } | null = null;
    let pull: { a: Body; b: Body; t: number } | null = null;
    let cool = 0;
    let sel: Body | null = null;
    let hover: Body | null = null;
    let lastTap: { body: Body; at: number } | null = null;
    let drag: { body: Body; t0: number; x0: number; y0: number; moved: boolean; lx: number; ly: number; lt: number; vx: number; vy: number } | null = null;
    let zoom = 1;
    let raf = 0;
    let last = 0;
    let cueTimer = 0;
    let stuckShown = false;
    let bodiesN = -1;

    const world = new World(bodiesEl, {
      resolve: id => {
        const n = latest.current.engine.get(id);
        return n ? { id: n.id, n: n.n, vis: n.vis, cat: n.cat, era: n.era } : null;
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
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      world.resize(r.width, r.height);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
      layoutZones();
      world.paintAll();
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

    /* ── loop ─────────────────────────────────────────────────────── */

    function wake() {
      if (raf || !latest.current.active) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    wakeRef.current = wake;

    const needFrame = () =>
      world.busy || !!session || !!resolving || !!pull || fx.alive || cool > 0 || !!drag || hits.size > 0 || world.touching().length > 0;

    function frame(now: number) {
      raf = 0;
      if (!latest.current.active) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      render();
      if (needFrame()) raf = requestAnimationFrame(frame);
    }

    function step(dt: number) {
      world.step(dt);
      if (cool > 0) cool -= dt;
      updatePull(dt);
      if (session) updateSession(dt);
      if (resolving) updateResolving(dt);
      if (!session && !resolving && !pull && cool <= 0) checkPairs();
      hits.clear();
      fx.update(dt);
      syncChrome();
    }

    /* ── attempts ─────────────────────────────────────────────────── */

    function checkPairs() {
      for (const p of world.touching()) {
        if (p.a.temp || p.b.temp || p.a.locked || p.b.locked) continue;
        const hit = hits.get(p.key);
        if (hit || p.t > 0.22) { attempt(p.a, p.b, p.key); return; }
      }
    }

    function unlockBoth(a: Body, b: Body) { a.locked = b.locked = false; }

    /** Two bodies met. The game decides whether this is a process, an answer, or nothing. */
    function attempt(a: Body, b: Body, key: string) {
      const eng = latest.current.engine;
      world.latch(key);
      if (drag && (drag.body === a || drag.body === b)) { world.release(drag.body, 0, 0); drag = null; }
      if (!eng.has(a.itemId) || !eng.has(b.itemId)) { prune(); return; }
      const rid = eng.recipeFor(a.itemId, b.itemId);
      const node = rid ? eng.get(rid) : undefined;
      const tooEarly = !!node && !eng.has(node.id) && !eng.isRecipeUnlocked(node.id);
      if (!rid || !node || tooEarly) { answerNow(a, b); return; }
      // a way already found is not made twice; the Instant option skips the hands entirely
      if (eng.hasRoute(rid, a.itemId, b.itemId) || latest.current.instant) { beginResolve(a, b, 'quick', 0.26); return; }
      startSession(a, b, rid, pairId(a.itemId, b.itemId));
    }

    /** A pair that makes nothing, or is too early: the engine says so, the bodies refuse. */
    function answerNow(a: Body, b: Body) {
      latest.current.onBegin();
      const res = latest.current.onCombine(a.itemId, b.itemId);
      if (res.status === 'error') { removeQuiet(a, b); return; }
      if (res.status === 'new' || res.status === 'known') { finishWith(a, b, res); return; }
      // a refusal: they shove apart, dull and short
      world.repel(a, b, 320);
      fx.sound(res.status === 'tier_locked' ? 'chime' : 'tick', { vol: 0.5, rate: res.status === 'tier_locked' ? 0.7 : 0.8 });
      fx.shake(res.status === 'tier_locked' ? 1 : 2.4);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      fx.burst(mx, my, { n: 5, color: 'bone3', speed: 40, life: 0.3 });
      cool = 0.35;
      wake();
    }

    function beginResolve(a: Body, b: Body, tier: Tier, dur: number) {
      latest.current.onBegin();
      resolving = { a, b, t: 0, dur, tier };
      a.locked = b.locked = true; a.grabbable = b.grabbable = false;
      if (drag && (drag.body === a || drag.body === b)) { world.release(drag.body, 0, 0); drag = null; }
      wake();
    }

    function updateResolving(dt: number) {
      const r = resolving;
      if (!r) return;
      r.t += dt;
      const { a, b } = r;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const k = clamp(r.t / r.dur, 0, 1);
      // they draw into each other, and a major find glows before it lands
      world.glide(a, mx, my, 10 + k * 14); world.glide(b, mx, my, 10 + k * 14);
      a.z += (0 - a.z) * Math.min(1, dt * 12); b.z += (0 - b.z) * Math.min(1, dt * 12);
      a.glow = b.glow = r.tier === 'major' ? k : k * 0.5;
      if (r.tier === 'major' && r.t > 0.05 && !fx.alive) fx.ring(mx, my, a.r * (1.5 + k), { color: 'ochre', life: 0.7 });
      if (r.t >= r.dur) {
        resolving = null;
        a.glow = b.glow = 0;
        const res = latest.current.onCombine(a.itemId, b.itemId);
        if (res.status === 'error') { removeQuiet(a, b); return; }
        if (res.status === 'new' || res.status === 'known') { finishWith(a, b, res, r.tier); return; }
        // the answer changed under us: put them down and let them part
        unlockBoth(a, b); a.grabbable = b.grabbable = true;
        world.repel(a, b, 300); fx.sound('tick', { vol: 0.5 }); cool = 0.4;
      }
    }

    /** The engine said yes: the two become one, and the result stays on the bench. */
    function finishWith(a: Body, b: Body, res: Extract<CombineResult, { status: 'new' | 'known' }>, tier: Tier = 'quick') {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      world.remove(a, true); world.remove(b, true);
      const nb = world.spawn(res.node.id, mx, my, { pop: true, angle: 0 });
      if (nb) { nb.q = 0.3; nb.angle = 0; nb.targetAngle = 0; }
      const fresh = res.status === 'new';
      fx.ring(mx, my, world.unit * (fresh ? 2.6 : 1.8), { color: 'ochre', life: fresh ? 0.8 : 0.5, width: fresh ? 2 : 1.4 });
      fx.burst(mx, my, { n: fresh ? 16 : 8, color: 'ochre', speed: fresh ? 150 : 90, life: 0.6, size: 2.4 });
      fx.sound(fresh ? 'chime' : 'pop', { vol: fresh ? 0.9 : 0.6 });
      if (fresh && tier === 'major') { fx.flash(0.9); fx.shake(3); }
      lastTap = null;
      sel = null;
      cool = 0.3;
      wake();
    }

    function removeQuiet(a: Body, b: Body) { world.remove(a, true); world.remove(b, true); }

    /** After a reset, anything on the bench that is no longer held goes. */
    function prune() {
      const eng = latest.current.engine;
      let dropped = false;
      for (const b of [...world.bodies]) {
        if (b.temp) continue;
        if (!eng.has(b.itemId)) { if (session && (session.a === b || session.b === b)) { session.cancel(); endSession(false); } world.remove(b, true); dropped = true; }
      }
      if (dropped) { sel = null; lastTap = null; pull = null; resolving = null; wake(); }
    }
    const unsub = engine.subscribe(prune);

    /* ── sessions ─────────────────────────────────────────────────── */

    function startSession(a: Body, b: Body, rid: string, key: string) {
      const eng = latest.current.engine;
      const A = eng.get(a.itemId), B = eng.get(b.itemId), R = eng.get(rid);
      if (!A || !B || !R) return;
      latest.current.onBegin();
      const eraIndex = Math.max(0, eng.db.eras.findIndex(e => e.id === R.era));
      const spec = deriveSpec(A, B, R, { eraIndex, relax: eng.has(rid) });
      fx.pal = readPalette();
      if (pull) { unlockBoth(pull.a, pull.b); pull = null; }
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
      if (done) beginResolve(s.a, s.b, s.spec.tier, s.spec.tier === 'major' ? 0.8 : 0.34);
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
        unlockBoth(a, b);
        pull = null;
        world.unlatchAll();
        hits.set(world.pairKeyOf(a, b), { force: 0.12, speed: 160 });
        fx.sound('click', { vol: 0.4 });
      }
    }

    /* ── drawing ──────────────────────────────────────────────────── */

    function render() {
      const dpr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, world.w, world.h);
      g.save();
      world.paintAll();
      if (sel && world.bodies.includes(sel) && !session) {
        g.strokeStyle = fx.pal.ochre; g.lineWidth = 1.5; g.globalAlpha = 0.85;
        g.setLineDash([4, 5]);
        g.beginPath(); g.arc(sel.x, sel.y - sel.z, sel.r * 1.12, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
      }
      g.globalAlpha = 1;
      session?.draw(g);
      fx.draw(g, world.w, world.h);
      g.restore();
    }

    /** DOM that follows state but is not the canvas: zones, zoom, shake, progress, counts. */
    function syncChrome() {
      const zr = zonesRef.current;
      if (zr) {
        for (const el of Array.from(zr.children) as HTMLElement[]) {
          const id = el.dataset.z as ZoneId;
          el.classList.toggle('on', world.zones.has(id));
          el.classList.toggle('lit', session?.lit === id);
        }
      }
      stage.style.transform = `translate3d(${fx.shakeX.toFixed(2)}px, ${fx.shakeY.toFixed(2)}px, 0) scale(${zoom})`;
      const p = progRef.current;
      if (p) p.style.transform = `scaleX(${session ? session.progress : 0})`;
      const n = world.bodies.filter(b => !b.temp).length;
      if (n !== bodiesN) { bodiesN = n; setEmpty(n === 0); setCount(n); }
    }

    /* ── input ────────────────────────────────────────────────────── */

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.wb-tools, .wb-hud button')) return;
      unlockAudio();
      if (resolving) return;
      const p = local(e.clientX, e.clientY);
      host.setPointerCapture?.(e.pointerId);
      if (session) { session.pointerDown(p.x, p.y, e.pointerType as 'mouse' | 'touch' | 'pen'); wake(); return; }
      const b = world.bodyAt(p.x, p.y, q => !q.locked);
      if (!b) { sel = null; if (e.detail >= 2 && zoom !== 1) { zoom = 1; } wake(); return; }
      if (pull && (pull.a === b || pull.b === b)) { unlockBoth(pull.a, pull.b); pull = null; }
      world.grab(b, p.x, p.y);
      drag = { body: b, t0: performance.now(), x0: e.clientX, y0: e.clientY, moved: false, lx: p.x, ly: p.y, lt: performance.now(), vx: 0, vy: 0 };
      fx.sound(b.props.sound, { vol: 0.12, rate: 1.4 });
      world.unlatchAll();
      wake();
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e.clientX, e.clientY);
      if (session) { session.pointerMove(p.x, p.y); wake(); return; }
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
      if (session) { session.pointerUp(); wake(); return; }
      const d = drag;
      if (!d) return;
      drag = null;
      // a flick that ended a while ago is not a throw
      const fresh = performance.now() - d.lt < 90;
      world.release(d.body, fresh ? d.vx : 0, fresh ? d.vy : 0);
      if (!d.moved && performance.now() - d.t0 < 380) tap(d.body);
      wake();
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
    const onKey = (e: KeyboardEvent) => {
      if (!latest.current.active || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]:not([hidden])')) return;
      const k = e.key;
      if (k === 'Escape' && session) { session.cancel(); endSession(false); wake(); return; }
      if (session && (k === ' ' || k === 'e' || k === 'E' || k === 'r' || k === 'R')) {
        e.preventDefault();
        session.keyDown(k, e.shiftKey, e.repeat);
        wake();
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
    host.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);

    /* ── the handle the rest of the app uses ──────────────────────── */

    const freeSpot = (): { x: number; y: number } => {
      const xs = [0.5, 0.36, 0.64, 0.24, 0.76, 0.42, 0.58];
      const ys = [0.5, 0.38, 0.62, 0.3, 0.7];
      const cand: { x: number; y: number }[] = [];
      for (const fy of ys) for (const fx_ of xs) cand.push({ x: world.w * fx_, y: world.h * fy });
      cand.sort(() => Math.random() - 0.5);
      const loose = world.bodies.filter(b => !b.temp);
      for (const c of cand) if (loose.every(b => Math.hypot(b.x - c.x, b.y - c.y) > world.unit * 2.3)) return c;
      return { x: world.w * (0.3 + Math.random() * 0.4), y: world.h * (0.4 + Math.random() * 0.3) };
    };

    const spawn = (id: string, o: SpawnOptions = {}): boolean => {
      const eng = latest.current.engine;
      if (!eng.has(id)) return false;
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
      if (pairWith) { startPull(pairWith, b); lastTap = null; }
      else lastTap = o.tap ? { body: b, at: performance.now() } : null;
      wake();
      return true;
    };

    const unregister = registerBench({
      spawn,
      contains: (x, y) => {
        const r = host.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      },
      element: () => host,
    });

    api.current = {
      clear: () => {
        if (session) { session.cancel(); endSession(false); }
        for (const b of [...world.bodies]) world.remove(b, true);
        sel = null; lastTap = null; pull = null; resolving = null; drag = null; hits.clear();
        wake();
      },
      cancel: () => { if (session) { session.cancel(); endSession(false); wake(); } },
      skip: () => { if (session) { session.skip(); wake(); } },
      rotate: () => { if (session) { session.keyDown('r'); session.keyUp('r'); wake(); } },
    };

    resize();

    return () => {
      wakeRef.current = () => {};
      api.current = null;
      unregister();
      unsub();
      ro?.disconnect();
      if (!ro) window.removeEventListener('resize', resize);
      themeWatch.disconnect();
      mq.removeEventListener?.('change', onMq);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      host.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      window.clearTimeout(cueTimer);
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
      role="application"
      aria-label="Workbench. Drag two items together to combine them."
    >
      <div className="wb-stage" ref={stageRef}>
        <div className="wb-zones" ref={zonesRef} aria-hidden="true">
          {ZONES.map(z => <i key={z.id} className="wb-zone" data-z={z.id} data-label={z.label} />)}
        </div>
        <div className="wb-bodies" ref={bodiesRef} />
        <canvas className="wb-fx" ref={canvasRef} aria-hidden="true" />
      </div>

      {empty && (
        <p className="wb-empty mono" aria-hidden="true">
          Put two things on the bench.<br />Bring them together.
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

      <div className="wb-tools">
        {hud && rotatable && (
          <button type="button" className="chip" onClick={() => api.current?.rotate()} aria-label="Rotate the piece (R)">Rotate</button>
        )}
        {hud && stuck && (
          <button type="button" className="chip warm" onClick={() => api.current?.skip()}>Do it for me</button>
        )}
        {hud && (
          <button type="button" className="chip" onClick={() => api.current?.cancel()} aria-label="Let go and stop (Escape)">Let go</button>
        )}
        {!hud && count > 0 && (
          <button type="button" className="chip" onClick={() => api.current?.clear()}>Clear</button>
        )}
        <button type="button" className="chip" aria-pressed={instant} onClick={() => setInstant(!instant)}
          title="Skip the hands-on part: pairs combine on contact">Instant</button>
        <button type="button" className="chip" aria-pressed={sound} onClick={toggleSound}
          aria-label={sound ? 'Sound on' : 'Sound off'} title="Material sounds">Sound</button>
      </div>

      <div className="wb-prog" aria-hidden="true"><i ref={progRef} /></div>
      <p className="sr" aria-live="polite">{say}</p>
    </div>
  );
}
