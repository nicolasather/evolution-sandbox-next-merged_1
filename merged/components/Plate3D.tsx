'use client';

import { useEffect, useRef, useState } from 'react';
import { Glyph } from './Glyph';
import { markup, type GlyphNode } from '@/lib/glyphs';
import { buildModel, type Model } from '@/lib/plate3d';
import { cssVar, THEME_EVENT } from '@/lib/theme';
import { cn } from '@/lib/utils';

/* ============================================================================
   PLATE 3D — a discovery's drawing as a floating, spinnable wireframe object.

   Canvas 2D with a hand-rolled perspective projection: no WebGL, no library.
   The object floats (slow bob + sway), sits in a small cloud of drifting
   particles, and turns freely when dragged with the mouse (touch: sideways
   swipe; keyboard: arrow keys). Colours come from the theme tokens
   --plate-line / --plate-spark / --plate-glow, so light, dark and neon each
   get their own look.

   The flat SVG glyph is rendered first (server render, no-JS, tests) and is
   swapped out only once the canvas has actually drawn a frame.
   ========================================================================== */

type Variant = 'exhibit' | 'card';

interface Palette { line: string; spark: string; glow: number; light: boolean }

interface Particle {
  th: number; rho: number; y: number; w: number; vy: number; s: number; ph: number;
}

const TAU = Math.PI * 2;
/** Perspective focal length in drawing units — smaller is a stronger lens. */
const FOCAL = 230;

function readPalette(): Palette {
  const theme = document.documentElement.dataset.theme;
  return {
    line: cssVar('--plate-line', '#e9e5dd'),
    spark: cssVar('--plate-spark', '#c4642c'),
    glow: parseFloat(cssVar('--plate-glow', '0')) || 0,
    light: theme === 'light',
  };
}

/** A soft round sprite for particles, tinted once per theme. */
function makeSprite(color: string, light: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, color);
    grd.addColorStop(light ? 0.5 : 0.22, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
  }
  return c;
}

function seededParticles(n: number, R: number, seed: number): Particle[] {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      th: rnd() * TAU,
      // a third of the motes sit inside the object's volume, the rest around it
      rho: R * (i % 3 === 0 ? 0.15 + rnd() * 0.55 : 0.55 + rnd() * 0.75),
      y: (rnd() * 2 - 1) * R * 1.05,
      w: (0.12 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1),
      vy: R * (0.02 + rnd() * 0.06),
      s: 0.5 + rnd() * 1.1,
      ph: rnd() * TAU,
    });
  }
  return out;
}

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Shortest signed angle from a to b. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function Plate3D({
  node, locked = false, variant = 'exhibit', label,
}: {
  node: GlyphNode;
  locked?: boolean;
  variant?: Variant;
  /** Accessible name; defaults to a generic description. */
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  const [touched, setTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const key = node.id;
  const src = markup(node);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const model: Model | null = buildModel(key, src);
    if (!model || !model.lines.length) return;

    const card = variant === 'card';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const R = model.radius;

    let pal = readPalette();
    let sprite = makeSprite(pal.spark, pal.light);
    const particles = seededParticles(locked ? (card ? 6 : 18) : (card ? 18 : 78), R, hashStr(key));

    // ── view state ──
    const st = {
      yaw: -0.5, pitch: -0.16, vYaw: 0, vPitch: 0,
      dragging: false, lastX: 0, lastY: 0, lastT: 0, idleAt: -1e9,
      t: 0, w: 0, h: 0, dpr: 1, visible: true, raf: 0, prev: 0, drew: false,
    };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
      canvas.width = Math.round(st.w * st.dpr);
      canvas.height = Math.round(st.h * st.dpr);
      if (!st.raf) draw();
    };

    // projection scratch
    let proj = new Float32Array(0);

    function draw() {
      const { w, h, dpr } = st;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      const fit = card ? 0.46 : 0.41;
      const scale = (Math.min(w, h) * fit) / R;
      const bob = reduce ? 0 : Math.sin(st.t * 1.15) * R * 0.05;
      const cx = w / 2, cy = h / 2;

      const cyw = Math.cos(st.yaw), syw = Math.sin(st.yaw);
      const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const roll = reduce ? 0 : Math.sin(st.t * 0.7) * 0.025;
      const cr = Math.cos(roll), sr = Math.sin(roll);

      const lockA = locked ? 0.22 : 1;

      // shadow on the "floor": shrinks and fades as the object rises
      if (!card) {
        const lift = bob / (R * 0.05 || 1);
        const fy = cy + R * scale * 1.12;
        const fr = R * scale * (0.8 - lift * 0.06);
        ctx!.save();
        ctx!.translate(cx, fy);
        ctx!.scale(1, 0.16);
        const grd = ctx!.createRadialGradient(0, 0, 0, 0, 0, fr);
        grd.addColorStop(0, pal.light ? 'rgba(40,30,20,.16)' : (pal.glow ? 'rgba(0,180,255,.20)' : 'rgba(0,0,0,.45)'));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.fillStyle = grd;
        ctx!.globalAlpha = lockA * (0.9 - lift * 0.15);
        ctx!.beginPath(); ctx!.arc(0, 0, fr, 0, TAU); ctx!.fill();
        ctx!.restore();
      }

      // project one point: yaw about Y, pitch about X, a touch of roll, then perspective
      const P = (x: number, y: number, z: number, out: Float32Array, o: number) => {
        const x1 = x * cyw + z * syw;
        const z1 = -x * syw + z * cyw;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const xr = x1 * cr - y2 * sr, yr = x1 * sr + y2 * cr;
        const k = FOCAL / (FOCAL - z2);
        out[o] = cx + xr * k * scale;
        out[o + 1] = cy + (yr + bob) * k * scale;
        out[o + 2] = z2;
      };

      // ── particles behind the object (z < 0 after rotation) and in front ──
      const pts: { x: number; y: number; z: number; s: number; a: number }[] = [];
      const tmp = new Float32Array(3);
      for (const q of particles) {
        const x = Math.cos(q.th) * q.rho, z = Math.sin(q.th) * q.rho;
        P(x, q.y, z, tmp, 0);
        const tw = 0.55 + 0.45 * Math.sin(st.t * 2.1 + q.ph);
        pts.push({ x: tmp[0], y: tmp[1], z: tmp[2], s: q.s, a: tw });
      }
      const drawParticles = (front: boolean) => {
        ctx!.save();
        ctx!.globalCompositeOperation = pal.light ? 'source-over' : 'lighter';
        for (const p of pts) {
          if ((p.z >= 0) !== front) continue;
          const near = Math.max(0, Math.min(1, (p.z / R + 1) / 2));
          const size = (card ? 5 : 9) * (pal.light ? 0.5 : 1) * p.s * (0.6 + near * 0.8) * (scale / 2.2) ** 0.35;
          ctx!.globalAlpha = lockA * p.a * (0.25 + near * 0.6) * (pal.light ? 0.7 : 1);
          ctx!.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
        }
        ctx!.restore();
      };
      drawParticles(false);

      // ── the object: project every line, bucket by opacity, stroke per bucket ──
      const buckets: number[][] = Array.from({ length: 11 }, () => []);
      const widths: number[] = [];
      let off = 0;
      let need = 0;
      for (const l of model!.lines) need += l.p.length;
      if (proj.length < need) proj = new Float32Array(need);
      const starts: number[] = [];
      model!.lines.forEach((l, li) => {
        const n = l.p.length / 3;
        let zs = 0;
        starts.push(off);
        for (let i = 0; i < n; i++) {
          P(l.p[i * 3], l.p[i * 3 + 1], l.p[i * 3 + 2], proj, off + i * 3);
          zs += proj[off + i * 3 + 2];
        }
        off += n * 3;
        const near = Math.max(0, Math.min(1, (zs / n / R + 1) / 2));
        const a = l.a * (0.38 + 0.62 * near);
        buckets[Math.max(0, Math.min(10, Math.round(a * 10)))].push(li);
        widths[li] = l.w;
      });

      const baseW = Math.max(1, Math.min(card ? 1.8 : 2.4, scale * (card ? 0.9 : 1.05)));
      ctx!.save();
      ctx!.lineCap = 'round';
      ctx!.lineJoin = 'round';
      ctx!.strokeStyle = pal.line;
      if (pal.glow && !locked) { ctx!.shadowColor = pal.spark; ctx!.shadowBlur = (card ? 6 : 12); }
      for (let b = 1; b <= 10; b++) {
        const list = buckets[b];
        if (!list.length) continue;
        // two weights per bucket are enough: main strokes and hairlines
        for (const thin of [false, true]) {
          ctx!.beginPath();
          let any = false;
          for (const li of list) {
            if ((widths[li] < 0.8) !== thin) continue;
            const s = starts[li], n = model!.lines[li].p.length / 3;
            ctx!.moveTo(proj[s], proj[s + 1]);
            for (let i = 1; i < n; i++) ctx!.lineTo(proj[s + i * 3], proj[s + i * 3 + 1]);
            any = true;
          }
          if (!any) continue;
          ctx!.globalAlpha = lockA * (b / 10);
          ctx!.lineWidth = thin ? baseW * 0.6 : baseW;
          ctx!.stroke();
        }
      }
      // accent dots
      ctx!.fillStyle = pal.line;
      for (const d of model!.dots) {
        P(d.x, d.y, d.z, tmp, 0);
        const near = Math.max(0, Math.min(1, (tmp[2] / R + 1) / 2));
        ctx!.globalAlpha = lockA * d.a * (0.45 + 0.55 * near);
        ctx!.beginPath();
        ctx!.arc(tmp[0], tmp[1], Math.max(0.8, d.r * scale * FOCAL / (FOCAL - tmp[2])), 0, TAU);
        ctx!.fill();
      }
      ctx!.restore();

      drawParticles(true);

      // registration ticks of the specimen plate — fixed, they do not turn
      if (!card) {
        const e = Math.min(w, h) * 0.44, t = Math.max(8, e * 0.1);
        ctx!.save();
        ctx!.strokeStyle = pal.line;
        ctx!.globalAlpha = 0.3;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.moveTo(cx - e, cy - e + t); ctx!.lineTo(cx - e, cy - e); ctx!.lineTo(cx - e + t, cy - e);
        ctx!.moveTo(cx + e, cy + e - t); ctx!.lineTo(cx + e, cy + e); ctx!.lineTo(cx + e - t, cy + e);
        ctx!.stroke();
        ctx!.restore();
      }

      if (!st.drew) { st.drew = true; setLive(true); }
    }

    function step(now: number) {
      st.raf = 0;
      const dt = Math.min(0.05, st.prev ? (now - st.prev) / 1000 : 0.016);
      st.prev = now;
      st.t += dt;

      // particles drift: orbit the vertical axis and rise, wrapping at the top
      const pm = reduce ? 0.15 : 1;
      for (const q of particles) {
        q.th += q.w * dt * pm;
        q.y -= q.vy * dt * pm;
        if (q.y < -R * 1.1) q.y = R * 1.1;
      }

      if (!st.dragging) {
        // inertia after a flick
        st.yaw += st.vYaw * dt;
        st.pitch += st.vPitch * dt;
        const damp = Math.exp(-dt * 2.4);
        st.vYaw *= damp; st.vPitch *= damp;
        // once settled, drift back to a gentle sway that faces the viewer
        if (!reduce && now - st.idleAt > 2600 && Math.abs(st.vYaw) < 0.05) {
          const targetYaw = Math.sin(st.t * 0.45) * 0.62;
          const targetPitch = -0.16 + Math.sin(st.t * 0.33) * 0.07;
          st.yaw += angleDelta(st.yaw, targetYaw) * Math.min(1, dt * 1.6);
          st.pitch += (targetPitch - st.pitch) * Math.min(1, dt * 1.6);
        }
        st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch));
      }

      draw();
      const moving = st.dragging || Math.abs(st.vYaw) > 1e-3 || Math.abs(st.vPitch) > 1e-3;
      if (st.visible && !document.hidden && (!reduce || moving)) {
        st.raf = requestAnimationFrame(step);
      }
    }
    const start = () => { if (!st.raf && st.visible && !document.hidden) { st.prev = 0; st.raf = requestAnimationFrame(step); } };
    const stop = () => { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; };

    // ── input ──
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      st.dragging = true; setDragging(true); setTouched(true);
      st.lastX = e.clientX; st.lastY = e.clientY; st.lastT = performance.now();
      st.vYaw = st.vPitch = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      start();
    };
    const onMove = (e: PointerEvent) => {
      if (!st.dragging) return;
      const now = performance.now();
      const dx = e.clientX - st.lastX, dy = e.clientY - st.lastY;
      const dt = Math.max(0.008, (now - st.lastT) / 1000);
      const k = card ? 0.02 : 0.011;
      st.yaw += dx * k;
      // on touch, vertical movement belongs to page scroll (touch-action: pan-y)
      const dp = e.pointerType === 'touch' ? 0 : dy * k;
      st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + dp));
      st.vYaw = (dx * k) / dt; st.vPitch = dp / dt;
      st.lastX = e.clientX; st.lastY = e.clientY; st.lastT = now;
    };
    const onUp = (e: PointerEvent) => {
      if (!st.dragging) return;
      st.dragging = false; setDragging(false);
      st.idleAt = performance.now();
      // a flick carries on; a slow release stops
      if (performance.now() - st.lastT > 90) st.vYaw = st.vPitch = 0;
      st.vYaw = Math.max(-9, Math.min(9, st.vYaw));
      st.vPitch = Math.max(-4, Math.min(4, st.vPitch));
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowLeft') st.vYaw -= 2.2;
      else if (k === 'ArrowRight') st.vYaw += 2.2;
      else if (k === 'ArrowUp') st.vPitch -= 1.4;
      else if (k === 'ArrowDown') st.vPitch += 1.4;
      else if (k === 'Home' || k === '0') { st.yaw = -0.5; st.pitch = -0.16; st.vYaw = st.vPitch = 0; }
      else return;
      e.preventDefault();
      setTouched(true);
      st.idleAt = performance.now();
      start();
    };
    const onDbl = () => { st.vYaw = st.vYaw >= 0 ? 7 : -7; st.idleAt = performance.now(); start(); };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('dblclick', onDbl);
    wrap.addEventListener('keydown', onKey);

    const onTheme = () => { pal = readPalette(); sprite = makeSprite(pal.spark, pal.light); if (!st.raf) draw(); };
    window.addEventListener(THEME_EVENT, onTheme);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    resize();

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([en]) => { st.visible = en.isIntersecting; if (st.visible) start(); else stop(); })
      : null;
    io?.observe(wrap);
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVis);

    start();

    return () => {
      stop();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('dblclick', onDbl);
      wrap.removeEventListener('keydown', onKey);
      window.removeEventListener(THEME_EVENT, onTheme);
      document.removeEventListener('visibilitychange', onVis);
      ro?.disconnect();
      io?.disconnect();
      setLive(false);
    };
  }, [key, src, locked, variant]);

  const name = label ?? 'Discovery';
  return (
    <div
      ref={wrapRef}
      className={cn('p3d', `p3d-${variant}`, live && 'live', touched && 'touched', dragging && 'dragging')}
      tabIndex={variant === 'exhibit' ? 0 : -1}
      role="img"
      aria-label={`${name} — 3D model. Drag, or use the arrow keys, to turn it.`}
    >
      <span className="p3d-flat" aria-hidden="true">
        <Glyph node={node} plate={variant === 'exhibit'} locked={locked} sw={variant === 'exhibit' ? 1.6 : undefined} />
      </span>
      <canvas ref={canvasRef} aria-hidden="true" />
      {variant === 'exhibit' && live && <span className="p3d-hint mono" aria-hidden="true">Drag to turn</span>}
    </div>
  );
}
