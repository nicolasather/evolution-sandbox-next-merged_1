'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';

interface Pos { x: number; y: number; node: Discovery; col: number }
interface Layout { pos: Record<string, Pos>; edges: [string, string][]; colw: number }

const COLW = 230, ROWH = 34;
const RARITY_FILL: Record<string, string> = {
  common: '#7e7a73', uncommon: '#8fa08d', rare: '#c09a4e', hidden: '#d8623f',
};

function buildLayout(engine: Engine): Layout {
  const cols = new Map<string, Discovery[]>();
  engine.db.eras.forEach(e => cols.set(e.id, []));
  engine.db.nodes.forEach(n => (cols.get(n.era) ?? cols.get('origins')!).push(n));

  const pos: Record<string, Pos> = Object.create(null);
  engine.db.eras.forEach((e, ci) => {
    const list = (cols.get(e.id) ?? []).slice()
      .sort((a, b) => (a.depth || 0) - (b.depth || 0) || a.no - b.no);
    list.forEach((n, ri) => {
      pos[n.id] = {
        x: ci * COLW + (ri % 2 ? 58 : 0),
        y: ri * ROWH - (list.length * ROWH) / 2,
        node: n, col: ci,
      };
    });
  });

  const edges: [string, string][] = [];
  engine.db.nodes.forEach(n => n.rec?.forEach(([a, b]) => {
    if (pos[a] && pos[n.id]) edges.push([a, n.id]);
    if (pos[b] && pos[n.id]) edges.push([b, n.id]);
  }));

  return { pos, edges, colw: COLW };
}

export function GraphView({
  engine, version, active, onlyPath, onOnlyPathChange, fitSignal, onOpen,
}: {
  engine: Engine;
  /** The engine's change counter — a repaint is due whenever it moves. */
  version: number;
  active: boolean;
  onlyPath: boolean;
  onOnlyPathChange: (next: boolean) => void;
  /** Bumped by the parent to ask for "frame the current selection" (the ending does this). */
  fitSignal: number;
  onOpen: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: number } | null>(null);
  const hover = useRef<string | null>(null);
  const queued = useRef(false);
  const draws = useRef(0);
  const [tip, setTip] = useState<{ x: number; y: number; node: Discovery } | null>(null);

  const layout = useMemo(() => buildLayout(engine), [engine]);

  const fit = useCallback((ids?: string[]) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const list = ids ?? Object.keys(layout.pos);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    list.forEach(id => {
      const p = layout.pos[id]; if (!p) return;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    if (!isFinite(minX)) return;
    const pad = 90;
    const k = Math.min(
      (w - pad * 2) / Math.max(1, maxX - minX),
      (h - pad * 2) / Math.max(1, maxY - minY), 1.6);
    view.current.k = Math.max(0.09, k);
    view.current.x = w / 2 - ((minX + maxX) / 2) * view.current.k;
    view.current.y = h / 2 - ((minY + maxY) / 2) * view.current.k;
  }, [layout]);

  const pick = useCallback((mx: number, my: number): string | null => {
    let best: string | null = null, bd = 256;
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
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    const { x: tx, y: ty, k } = view.current;
    const show = (id: string) => !onlyPath || engine.has(id);
    const X = (p: Pos) => p.x * k + tx, Y = (p: Pos) => p.y * k + ty;

    // era rules
    engine.db.eras.forEach((_, i) => {
      const x = i * layout.colw * k + tx;
      if (x < -180 || x > w + 180) return;
      c.strokeStyle = 'rgba(233,229,221,.045)';
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
      c.strokeStyle = hot ? 'rgba(196,100,44,.72)' : known ? 'rgba(233,229,221,.14)' : 'rgba(233,229,221,.035)';
      c.beginPath();
      c.moveTo(ax, ay);
      c.bezierCurveTo(ax + (bx - ax) * 0.5, ay, bx - (bx - ax) * 0.5, by, bx, by);
      c.stroke();
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
      const r = known ? (hover.current === id ? 6.5 : 4.6) : 2.2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = known ? (RARITY_FILL[p.node.rar] ?? '#7e7a73') : 'rgba(233,229,221,.16)';
      c.fill();
      if (known) {
        c.beginPath(); c.arc(x, y, r + 3.5, 0, Math.PI * 2);
        c.strokeStyle = hover.current === id ? 'rgba(196,100,44,.9)' : 'rgba(233,229,221,.16)';
        c.lineWidth = 1; c.stroke();
      }
      if (k > 0.55 && (known || k > 1.05)) {
        c.fillStyle = known ? 'rgba(233,229,221,.78)' : 'rgba(233,229,221,.24)';
        c.fillText(p.node.n, x + 10, y + 4);
      }
    }

    // era header band, painted last so nothing pans over the labels
    c.fillStyle = 'rgba(10,10,11,.92)';
    c.fillRect(0, 0, w, 34);
    c.strokeStyle = 'rgba(233,229,221,.10)';
    c.beginPath(); c.moveTo(0, 34.5); c.lineTo(w, 34.5); c.stroke();
    c.font = '10px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = 'rgba(233,229,221,.34)';
    engine.db.eras.forEach((e, i) => {
      const x = i * layout.colw * k + tx;
      if (x < -180 || x > w + 180) return;
      c.fillText(e.name.toUpperCase(), x + 10, 21);
    });

    cv.dataset.draws = String(++draws.current);   // lets the smoke test prove the canvas idles
  }, [engine, layout, onlyPath]);

  /** One repaint on the next frame, only while the graph is on screen. It used
   *  to repaint every frame whether or not anything had moved. */
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; });
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; });
  const requestDraw = useCallback(() => {
    if (queued.current || !activeRef.current) return;
    queued.current = true;
    requestAnimationFrame(() => { queued.current = false; if (activeRef.current) drawRef.current(); });
  }, []);

  // anything that changes the picture — becoming visible, a discovery, the
  // path filter — asks for exactly one repaint
  useEffect(() => { if (active) requestDraw(); }, [active, version, onlyPath, draw, requestDraw]);

  // first activation: frame the whole territory until there is a path worth framing
  const framed = useRef(false);
  useEffect(() => {
    if (!active || framed.current) return;
    framed.current = true;
    const p = engine.path().map(n => n.id);
    requestAnimationFrame(() => { fit(p.length > 14 ? p : undefined); requestDraw(); });
  }, [active, engine, fit, requestDraw]);

  // the parent asked to frame the current selection (e.g. "See the whole path")
  useEffect(() => {
    if (!fitSignal) return;
    framed.current = true;
    requestAnimationFrame(() => {
      fit(onlyPath ? engine.path().map(n => n.id) : undefined);
      requestDraw();
    });
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
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const f = Math.exp(-e.deltaY * 0.0016);
      const nk = Math.max(0.09, Math.min(2.6, view.current.k * f));
      view.current.x = px - (px - view.current.x) * (nk / view.current.k);
      view.current.y = py - (py - view.current.y) * (nk / view.current.k);
      view.current.k = nk;
      requestDraw();
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [requestDraw]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pathIds = () => engine.path().map(n => n.id);

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-graph" role="tabpanel" aria-label="Discovery graph">
      <canvas
        id="gcanvas"
        ref={canvasRef}
        onPointerDown={e => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          const p = local(e);
          drag.current = { x: p.x, y: p.y, vx: view.current.x, vy: view.current.y, moved: 0 };
        }}
        onPointerMove={e => {
          const p = local(e);
          if (drag.current) {
            view.current.x = drag.current.vx + (p.x - drag.current.x);
            view.current.y = drag.current.vy + (p.y - drag.current.y);
            drag.current.moved += Math.abs(p.x - drag.current.x) + Math.abs(p.y - drag.current.y);
            requestDraw();
            return;
          }
          const id = pick(p.x, p.y);
          if (id !== hover.current) {
            hover.current = id;
            if (id) {
              const pos = layout.pos[id];
              setTip({
                x: pos.x * view.current.k + view.current.x,
                y: pos.y * view.current.k + view.current.y,
                node: pos.node,
              });
            } else setTip(null);
            requestDraw();
          }
        }}
        onPointerUp={e => {
          const d = drag.current;
          drag.current = null;
          if (d && d.moved < 5) {
            const id = pick(d.x, d.y);
            if (id) onOpen(id);
          }
          (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        }}
      />

      <div className="g-overlay">
        <h2 className="g-title">The whole graph</h2>
        <p className="g-sub">
          Every discovery, arranged by era. Lines are dependencies — many things have more than
          one way in. Drag to move, scroll to zoom, click a node to open it.
        </p>
      </div>

      <div className="g-ctrl">
        <button
          className="chip" id="g-onlypath" aria-pressed={onlyPath}
          onClick={() => {
            const next = !onlyPath;
            onOnlyPathChange(next);
            fit(next ? pathIds() : undefined);
            requestDraw();
          }}
        >
          Only my path
        </button>
        <button className="chip" id="g-fit" onClick={() => { fit(onlyPath ? pathIds() : undefined); requestDraw(); }}>
          Fit to view
        </button>
      </div>

      <div className="g-legend mono">
        <span><i className="dot common" />common</span>
        <span><i className="dot uncommon" />uncommon</span>
        <span><i className="dot rare" />rare</span>
        <span><i className="dot hidden" />hidden</span>
        <span style={{ opacity: 0.6 }}>faint = not found yet</span>
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
