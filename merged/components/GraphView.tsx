'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';
import { cssVar, THEME_EVENT } from '@/lib/theme';

interface Trace { up: Set<string>; down: Set<string>; upEdges: Set<string>; downEdges: Set<string> }
interface Pos { x: number; y: number; node: Discovery; col: number }
interface Layout { pos: Record<string, Pos>; edges: [string, string][]; eraX: number[] }
interface Palette {
  bone: string; faint: string; line: string; ochre: string; ink: string; band: string;
  rar: Record<string, string>;
}

const ROWH = 34, SUBW = 176, ERA_GAP = 64, MAX_ROWS = 22;
const MIN_K = 0.09, MAX_K = 2.6;

/** Everything upstream along the routes the player used, and what it went on to make. */
function traceOf(engine: Engine, focusId: string): Trace {
  const up = new Set<string>([focusId]);
  const upEdges = new Set<string>();
  const stack = [focusId];
  while (stack.length) {
    const id = stack.pop()!;
    engine.get(id)?.rec?.forEach(([a, b]) => {
      if (!engine.hasRoute(id, a, b)) return;
      for (const x of [a, b]) {
        upEdges.add(`${x}>${id}`);
        if (!up.has(x)) { up.add(x); stack.push(x); }
      }
    });
  }
  const down = new Set<string>();
  const downEdges = new Set<string>();
  const q = [focusId];
  while (q.length) {
    const id = q.shift()!;
    for (const u of engine.usesOf(id)) {
      if (!engine.has(u)) continue;
      const used = engine.get(u)!.rec.some(([a, b]) => (a === id || b === id) && engine.hasRoute(u, a, b));
      if (!used) continue;
      downEdges.add(`${id}>${u}`);
      if (!down.has(u)) { down.add(u); q.push(u); }
    }
  }
  return { up, down, upEdges, downEdges };
}

/** Eras are columns; an era with many entries wraps into several sub-columns
 *  instead of one very tall one, so the whole map fits a screen at a readable size. */
function buildLayout(engine: Engine): Layout {
  const cols = new Map<string, Discovery[]>();
  engine.db.eras.forEach(e => cols.set(e.id, []));
  engine.db.nodes.forEach(n => (cols.get(n.era) ?? cols.get('origins')!).push(n));

  const pos: Record<string, Pos> = Object.create(null);
  const eraX: number[] = [];
  let x0 = 0;
  engine.db.eras.forEach((e, ci) => {
    eraX.push(x0);
    const list = (cols.get(e.id) ?? []).slice()
      .sort((a, b) => (a.depth || 0) - (b.depth || 0) || a.no - b.no);
    const nsub = Math.max(1, Math.ceil(list.length / MAX_ROWS));
    const rows = Math.ceil(list.length / nsub);
    list.forEach((n, i) => {
      const sub = Math.floor(i / rows), ri = i % rows;
      pos[n.id] = { x: x0 + 18 + sub * SUBW, y: ri * ROWH - (rows * ROWH) / 2, node: n, col: ci };
    });
    x0 += nsub * SUBW + ERA_GAP;
  });

  const edges: [string, string][] = [];
  engine.db.nodes.forEach(n => n.rec?.forEach(([a, b]) => {
    if (pos[a] && pos[n.id]) edges.push([a, n.id]);
    if (pos[b] && pos[n.id] && b !== a) edges.push([b, n.id]);
  }));

  return { pos, edges, eraX };
}

/** rgb(a) string with a new alpha. Accepts #rrggbb or rgba(). */
function alpha(color: string, a: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) { const [r, g, b] = m[1].split(',').map(s => s.trim()); return `rgba(${r},${g},${b},${a})`; }
  return color;
}

function readPalette(): Palette {
  return {
    bone: cssVar('--bone', '#e9e5dd'),
    faint: cssVar('--bone-4', '#66625c'),
    line: cssVar('--line-3', 'rgba(233,229,221,.30)'),
    ochre: cssVar('--ochre', '#c4642c'),
    ink: cssVar('--ink-0', '#0a0a0b'),
    band: cssVar('--glass-sticky', 'rgba(10,10,11,.93)'),
    rar: {
      common: cssVar('--r-common', '#7e7a73'), uncommon: cssVar('--r-uncommon', '#8fa08d'),
      rare: cssVar('--r-rare', '#c09a4e'), hidden: cssVar('--r-hidden', '#d8623f'),
    },
  };
}

export function GraphView({
  engine, version, active, onlyPath, onOnlyPathChange, fitSignal, focusId, onOpen,
}: {
  engine: Engine;
  /** The engine's change counter — a repaint is due whenever it moves. */
  version: number;
  active: boolean;
  onlyPath: boolean;
  onOnlyPathChange: (next: boolean) => void;
  /** Bumped by the parent to ask for "frame the current selection" (the ending does this). */
  fitSignal: number;
  /** The open exhibit: its origins and descendants are traced on the graph. */
  focusId: string | null;
  onOpen: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: number } | null>(null);
  const pinch = useRef<{ d: number; k: number; cx: number; cy: number; vx: number; vy: number } | null>(null);
  const hover = useRef<string | null>(null);
  const queued = useRef(false);
  const draws = useRef(0);
  const palette = useRef<Palette | null>(null);
  const tween = useRef<number | null>(null);
  /** Discoveries made since the graph last showed them: they pulse once. */
  const pulses = useRef(new Map<string, number>());
  const knownAtLastDraw = useRef<Set<string> | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; node: Discovery } | null>(null);
  const [trace, setTrace] = useState(true);

  const layout = useMemo(() => buildLayout(engine), [engine]);

  // origins (everything upstream along routes the player used) and
  // descendants (what it went on to make), as node and edge sets
  const lineage = useMemo(() => {
    if (!focusId || !trace || !engine.has(focusId)) return null;
    return traceOf(engine, focusId);
    // version: the lineage grows as the player finds more
  }, [focusId, trace, engine, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // hovering a find lights its ancestors and descendants; cached per find
  const hoverCache = useRef<{ ver: number; map: Map<string, Trace | null> }>({ ver: -1, map: new Map() });
  const hoverTrace = useCallback((id: string): Trace | null => {
    const c = hoverCache.current;
    if (c.ver !== version) { c.ver = version; c.map = new Map(); }
    if (!c.map.has(id)) c.map.set(id, engine.has(id) ? traceOf(engine, id) : null);
    return c.map.get(id) ?? null;
  }, [engine, version]);
  /** Which trace is showing, and since when: a new one draws itself in. */
  const anim = useRef<{ key: string | null; t0: number }>({ key: null, t0: 0 });

  const fitBox = useCallback((ids?: string[], minK = MIN_K) => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    const list = ids ?? Object.keys(layout.pos);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    list.forEach(id => {
      const p = layout.pos[id]; if (!p) return;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    if (!isFinite(minX)) return null;
    const pad = w < 600 ? 50 : 90;
    const k = Math.max(minK, Math.min(
      (w - pad * 2) / Math.max(1, maxX - minX),
      (h - pad * 2) / Math.max(1, maxY - minY), 1.6));
    return { k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k };
  }, [layout]);

  const drawRef = useRef<() => void>(() => { /* set below */ });
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; });
  const requestDraw = useCallback(() => {
    if (queued.current || !activeRef.current) return;
    queued.current = true;
    requestAnimationFrame(() => { queued.current = false; if (activeRef.current) drawRef.current(); });
  }, []);

  /** Glide the camera instead of jumping — short, and instant under reduced motion. */
  const moveTo = useCallback((to: { x: number; y: number; k: number } | null) => {
    if (!to) return;
    if (tween.current) cancelAnimationFrame(tween.current);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = { ...view.current };
    if (reduce) { view.current = to; requestDraw(); return; }
    const t0 = performance.now(), dur = 380;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      view.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e };
      drawRef.current();
      tween.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    tween.current = requestAnimationFrame(step);
  }, [requestDraw]);

  const fit = useCallback((ids?: string[], animate = true, minK = MIN_K) => {
    const box = fitBox(ids, minK);
    if (!box) return;
    if (animate) moveTo(box); else { view.current = box; }
  }, [fitBox, moveTo]);

  const zoomBy = useCallback((f: number, px?: number, py?: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = px ?? cv.clientWidth / 2, cy = py ?? cv.clientHeight / 2;
    const v = view.current;
    const nk = Math.max(MIN_K, Math.min(MAX_K, v.k * f));
    return { x: cx - (cx - v.x) * (nk / v.k), y: cy - (cy - v.y) * (nk / v.k), k: nk };
  }, []);

  const pick = useCallback((mx: number, my: number, radius = 16): string | null => {
    let best: string | null = null, bd = radius * radius;
    const { x: tx, y: ty, k } = view.current;
    for (const id of Object.keys(layout.pos)) {
      if (onlyPath && !engine.has(id)) continue;
      const p = layout.pos[id];
      const dx = p.x * k + tx - mx, dy = p.y * k + ty - my;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }, [layout, onlyPath, engine]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const c = cv.getContext('2d');
    if (!c) return;
    const P = palette.current ?? (palette.current = readPalette());
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    // new discoveries since the last paint start a pulse
    const now = performance.now();
    if (knownAtLastDraw.current) {
      engine.found.forEach(id => { if (!knownAtLastDraw.current!.has(id)) pulses.current.set(id, now); });
    }
    knownAtLastDraw.current = new Set(engine.found);

    const { x: tx, y: ty, k } = view.current;
    const show = (id: string) => !onlyPath || engine.has(id);
    const X = (p: Pos) => p.x * k + tx, Y = (p: Pos) => p.y * k + ty;
    const hoverL = hover.current ? hoverTrace(hover.current) : null;
    const L = hoverL ?? lineage;
    const traceKey = L ? (hoverL ? `h:${hover.current}` : `f:${focusId}`) : null;
    if (anim.current.key !== traceKey) anim.current = { key: traceKey, t0: now };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // the route draws itself outward from the find in ~0.8s
    const drawP = !L || reduceMotion ? 1 : Math.min(1, (now - anim.current.t0) / 800);
    const ease = 1 - Math.pow(1 - drawP, 3);
    let animating = drawP < 1;
    const inTrace = (id: string) => !L || L.up.has(id) || L.down.has(id);

    // era rules
    c.strokeStyle = alpha(P.bone, 0.05);
    layout.eraX.forEach(ex => {
      const x = ex * k + tx;
      if (x < -180 || x > w + 180) return;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
    });

    // edges
    c.lineWidth = 1;
    layout.edges.forEach(([a, b]) => {
      const pa = layout.pos[a], pb = layout.pos[b];
      if (!pa || !pb || !show(a) || !show(b)) return;
      const ax = X(pa), ay = Y(pa), bx = X(pb), by = Y(pb);
      if ((ax < -60 && bx < -60) || (ax > w + 60 && bx > w + 60)) return;
      const known = engine.has(a) && engine.has(b);
      const hot = hover.current === a || hover.current === b;
      let style: string;
      if (L) {
        const onUp = L.upEdges.has(`${a}>${b}`);
        const onDown = L.downEdges.has(`${a}>${b}`);
        style = onUp ? alpha(P.ochre, 0.8) : onDown ? alpha(P.bone, 0.55) : alpha(P.bone, 0.03);
        c.lineWidth = onUp || onDown ? 1.4 : 1;
      } else {
        style = hot ? alpha(P.ochre, 0.72) : known ? alpha(P.bone, 0.14) : alpha(P.bone, 0.035);
        c.lineWidth = 1;
      }
      c.strokeStyle = style;
      c.beginPath();
      c.moveTo(ax, ay);
      c.bezierCurveTo(ax + (bx - ax) * 0.5, ay, bx - (bx - ax) * 0.5, by, bx, by);
      const lit = L && (L.upEdges.has(`${a}>${b}`) || L.downEdges.has(`${a}>${b}`));
      if (lit && ease < 1) {
        const len = Math.hypot(bx - ax, by - ay) * 1.25 + 20;
        c.setLineDash([len * ease, len]);
        c.stroke();
        c.setLineDash([]);
      } else c.stroke();
    });

    // nodes
    c.textAlign = 'left';
    c.font = '11px Archivo, sans-serif';
    for (const id of Object.keys(layout.pos)) {
      if (!show(id)) continue;
      const p = layout.pos[id];
      const x = X(p), y = Y(p);
      if (x < -80 || x > w + 240 || y < -30 || y > h + 30) continue;
      const known = engine.has(id);
      const lit = inTrace(id);
      const isFocus = id === focusId;
      const r = known ? (hover.current === id || isFocus ? 6.5 : 4.6) : 2.2;
      c.globalAlpha = lit ? 1 : (L ? 0.18 - 0.0 : 0.18);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = known ? (P.rar[p.node.rar] ?? P.rar.common) : alpha(P.bone, 0.16);
      c.fill();
      if (known) {
        c.beginPath(); c.arc(x, y, r + 3.5, 0, Math.PI * 2);
        c.strokeStyle = hover.current === id || isFocus ? alpha(P.ochre, 0.95) : alpha(P.bone, 0.16);
        c.lineWidth = isFocus ? 1.6 : 1; c.stroke();
      }
      const t0 = pulses.current.get(id);
      if (t0 !== undefined) {
        const age = (now - t0) / 1100;
        if (age >= 1) pulses.current.delete(id);
        else {
          animating = true;
          c.beginPath(); c.arc(x, y, r + 4 + age * 22, 0, Math.PI * 2);
          c.strokeStyle = alpha(P.ochre, 0.85 * (1 - age)); c.lineWidth = 2; c.stroke();
        }
      }
      // undiscovered entries are never named on the graph
      if (known && (k > 0.44 || isFocus || (L && lit && k > 0.3))) {
        c.fillStyle = alpha(P.bone, isFocus ? 1 : 0.78);
        c.fillText(p.node.n, x + 10, y + 4);
      }
      c.globalAlpha = 1;
    }

    // era header band, painted last so nothing pans over the labels
    c.fillStyle = P.band;
    c.fillRect(0, 0, w, 34);
    c.strokeStyle = alpha(P.bone, 0.10);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 34.5); c.lineTo(w, 34.5); c.stroke();
    c.font = '10px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = alpha(P.bone, 0.5);
    engine.db.eras.forEach((e, i) => {
      const x = layout.eraX[i] * k + tx;
      const next = (layout.eraX[i + 1] ?? layout.eraX[i] + 400) * k + tx;
      if (next < 0 || x > w) return;
      // keep the label on screen while any of its column is, and never over the next one
      const lx = Math.min(Math.max(x + 10, 10), next - 20);
      c.save();
      c.beginPath(); c.rect(x, 0, Math.max(0, next - x - 8), 34); c.clip();
      c.fillText(e.name.toUpperCase(), lx, 21);
      c.restore();
    });

    cv.dataset.draws = String(++draws.current);   // lets the smoke test prove the canvas idles
    if (animating) requestDraw();
  }, [engine, layout, onlyPath, lineage, focusId, requestDraw, hoverTrace]);
  useEffect(() => { drawRef.current = draw; });

  // anything that changes the picture — becoming visible, a discovery, the
  // path filter, the traced exhibit — asks for exactly one repaint
  useEffect(() => { if (active) requestDraw(); }, [active, version, onlyPath, draw, requestDraw]);

  // theme switch: re-read the palette
  useEffect(() => {
    const onTheme = () => { palette.current = null; requestDraw(); };
    window.addEventListener(THEME_EVENT, onTheme);
    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, [requestDraw]);

  // first activation: frame the whole territory until there is a path worth framing
  const framed = useRef(false);
  useEffect(() => {
    if (!active || framed.current) return;
    framed.current = true;
    // start on what the player has found, not on 300 unnamed dots
    const p = engine.path().map(n => n.id);
    // never so far out that the player's own finds lose their names
    requestAnimationFrame(() => { fit(p, false, 0.62); requestDraw(); });
  }, [active, engine, fit, requestDraw]);

  // the parent asked to frame the current selection (e.g. "See the whole path")
  useEffect(() => {
    if (!fitSignal) return;
    framed.current = true;
    requestAnimationFrame(() => { fit(onlyPath ? engine.path().map(n => n.id) : undefined); });
    // only the signal itself should trigger this
  }, [fitSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('resize', requestDraw);
    // canvas text is measured with whatever font is loaded; repaint once the real ones arrive
    if (document.fonts?.ready) document.fonts.ready.then(requestDraw).catch(() => { /* ignore */ });
    return () => window.removeEventListener('resize', requestDraw);
  }, [requestDraw]);

  // Wheel zoom needs preventDefault, which React's (passive) onWheel cannot do:
  // without it a trackpad pinch zoomed the whole page instead of the graph.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const to = zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
      if (to) { view.current = to; requestDraw(); }
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [requestDraw, zoomBy]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pathIds = () => engine.path().map(n => n.id);
  const focusOn = (id: string) => {
    const p = layout.pos[id];
    const cv = canvasRef.current;
    if (!p || !cv) return;
    const k = Math.max(view.current.k, 0.9);
    moveTo({ k, x: cv.clientWidth / 2 - p.x * k, y: cv.clientHeight / 2 - p.y * k });
  };

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-graph" role="tabpanel" aria-label="Discovery graph">
      <canvas
        id="gcanvas"
        ref={canvasRef}
        onPointerDown={e => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          const p = local(e);
          pointers.current.set(e.pointerId, p);
          if (tween.current) { cancelAnimationFrame(tween.current); tween.current = null; }
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = {
              d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.current.k,
              cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: view.current.x, vy: view.current.y,
            };
            drag.current = null;
            return;
          }
          drag.current = { x: p.x, y: p.y, vx: view.current.x, vy: view.current.y, moved: 0 };
        }}
        onPointerMove={e => {
          const p = local(e);
          if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
          if (pinch.current && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            const pc = pinch.current;
            const nk = Math.max(MIN_K, Math.min(MAX_K, pc.k * (Math.hypot(a.x - b.x, a.y - b.y) / pc.d)));
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
            view.current = {
              k: nk,
              x: cx - (pc.cx - pc.vx) * (nk / pc.k),
              y: cy - (pc.cy - pc.vy) * (nk / pc.k),
            };
            requestDraw();
            return;
          }
          if (drag.current) {
            view.current.x = drag.current.vx + (p.x - drag.current.x);
            view.current.y = drag.current.vy + (p.y - drag.current.y);
            drag.current.moved = Math.max(drag.current.moved, Math.abs(p.x - drag.current.x) + Math.abs(p.y - drag.current.y));
            requestDraw();
            return;
          }
          if (e.pointerType !== 'mouse') return;
          const id = pick(p.x, p.y);
          if (id !== hover.current) {
            hover.current = id;
            if (id) {
              const pos = layout.pos[id];
              setTip({ x: pos.x * view.current.k + view.current.x, y: pos.y * view.current.k + view.current.y, node: pos.node });
            } else setTip(null);
            requestDraw();
          }
        }}
        onPointerUp={e => {
          pointers.current.delete(e.pointerId);
          if (pinch.current) { if (pointers.current.size < 2) pinch.current = null; return; }
          const d = drag.current;
          drag.current = null;
          if (d && d.moved < 6) {
            const id = pick(d.x, d.y, e.pointerType === 'mouse' ? 16 : 26);
            if (id) onOpen(id);
          }
          try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        }}
        onPointerCancel={e => { pointers.current.delete(e.pointerId); pinch.current = null; drag.current = null; }}
        onPointerLeave={e => { if (e.pointerType === 'mouse' && hover.current) { hover.current = null; setTip(null); requestDraw(); } }}
      />

      <div className="g-overlay">
        <h2 className="g-title">Your graph</h2>
        <p className="g-sub">
          Every discovery, by era. Open one to trace where it came from
          <span className="swatch up" /> and what it led to<span className="swatch down" />.
          Unfound entries stay unnamed.
        </p>
      </div>

      <div className="g-ctrl">
        <div className="g-zoom">
          <button className="chip" aria-label="Zoom in" onClick={() => moveTo(zoomBy(1.45) ?? null)}>+</button>
          <button className="chip" aria-label="Zoom out" onClick={() => moveTo(zoomBy(1 / 1.45) ?? null)}>−</button>
        </div>
        <button
          className="chip" id="g-onlypath" aria-pressed={onlyPath}
          onClick={() => {
            const next = !onlyPath;
            onOnlyPathChange(next);
            fit(next ? pathIds() : undefined);
          }}
        >
          Only my finds
        </button>
        <button className="chip" id="g-fit" onClick={() => fit(onlyPath ? pathIds() : undefined)}>Fit</button>
        {focusId && engine.has(focusId) && (
          <>
            <button className="chip" onClick={() => focusOn(focusId)}>Go to {engine.get(focusId)?.n}</button>
            <button className="chip" aria-pressed={trace} onClick={() => setTrace(t => !t)}>Trace routes</button>
          </>
        )}
      </div>

      <div className="g-legend mono">
        <span><i className="dot r-common" />common</span>
        <span><i className="dot r-uncommon" />uncommon</span>
        <span><i className="dot r-rare" />rare</span>
        <span><i className="dot r-hidden" />hidden</span>
        <span style={{ opacity: 0.7 }}>faint = not found yet</span>
      </div>

      {tip && (
        <div className="g-tip on" style={{ left: tip.x, top: tip.y }}>
          <div className="t">{engine.has(tip.node.id) ? tip.node.n : 'Undiscovered'}</div>
          <div className="d">
            {engine.has(tip.node.id)
              ? tip.node.l1
              : `${engine.db.eras.find(e => e.id === tip.node.era)?.name} · not found yet`}
          </div>
        </div>
      )}
    </section>
  );
}
