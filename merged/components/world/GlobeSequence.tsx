'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { WorldDirector, Sample } from '@/lib/world/director';
import type { WorldPayload, MajorPayload, EraPayload } from '@/lib/world/moments';
import { GlobeGL } from '@/lib/world/gl';
import { loadLand } from '@/lib/world/land';
import { drawFallbackGlobe, drawOverlay, DEFAULT_STYLE, type OverlayScene, type OverlayStyle } from '@/lib/world/overlay';
import { SoftGlobe, sdfFromImage } from '@/lib/world/soft';
import { clamp } from '@/lib/world/geo';
import { getQuality } from '@/lib/perf';
import type { Certainty } from '@/lib/world/types';

/* ============================================================================
   GLOBE SEQUENCE — the picture: a fullscreen layer with the Earth, its
   markers and the card. It owns no game state. The director says what moment
   is playing and where in it we are; this draws that, every frame, and lets
   the visitor skip it.

   Layers, back to front:  scrim · globe (WebGL)  · overlay (2D: markers,
   arc, labels) · card. If WebGL is not available, or its context is lost, the
   overlay canvas draws a dotted globe instead, so the moment still lands.

   The card's opacity and position are written straight to the DOM each frame;
   React only re-renders when a moment starts or ends.
   ========================================================================== */

const CERTAINTY_NOTE: Record<Certainty, string | null> = {
  firm: null,
  regional: 'Region-level origin',
  debated: 'Origin debated',
  multiple: 'Several early centres',
  unknown: 'Origin unknown',
};

/** The warm light an era leaves when it is finished (RGB 0–1), by era. */
const ERA_GLOW: Record<string, [number, number, number]> = {
  origins: [0.89, 0.64, 0.37], fire: [0.93, 0.55, 0.30], settlement: [0.84, 0.70, 0.42], agriculture: [0.62, 0.78, 0.42],
  civilization: [0.90, 0.72, 0.38], trade: [0.88, 0.62, 0.36], metallurgy: [0.92, 0.50, 0.28], science: [0.72, 0.78, 0.90],
  industry: [0.80, 0.62, 0.50], electric: [0.50, 0.75, 0.95], computing: [0.42, 0.82, 0.86], network: [0.45, 0.68, 0.98],
  games: [0.72, 0.55, 0.95], simulation: [0.90, 0.48, 0.55],
};
const DEFAULT_GLOW: [number, number, number] = [0.89, 0.64, 0.37];

/** How many device pixels per CSS pixel each quality tier may spend. */
const MAX_SCALE = { high: 2, medium: 1.5, low: 1 } as const;

export interface GlobeSequenceProps {
  director: WorldDirector<WorldPayload>;
  /** Called after a skip; `all` is true for Escape (the whole queue was dropped). */
  onSkip?: (all: boolean) => void;
}

function announcement(p: WorldPayload | null): string {
  if (!p) return '';
  if (p.kind === 'era') return `Era complete: ${p.eraName}.${p.next ? ` ${p.next.name} is now open.` : ''}`;
  const m = p.major;
  return `Major invention: ${m.name}. ${m.region}. ${m.period}. ${m.fact}`;
}

export function GlobeSequence({ director, onSkip }: GlobeSequenceProps) {
  useSyncExternalStore(director.subscribe, director.getVersion, () => 0);
  const current = director.current;
  const payload = current?.payload ?? null;

  const rootRef = useRef<HTMLDivElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const ovCanvas = useRef<HTMLCanvasElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const gl = useRef<GlobeGL | null>(null);
  const glFailed = useRef(false);
  const landAsked = useRef(false);
  const land = useRef<HTMLImageElement | null>(null);
  const soft = useRef<SoftGlobe | null>(null);
  const scene = useRef<{ id: number; scene: OverlayScene } | null>(null);
  const size = useRef({ w: 0, h: 0, scale: 1, cap: 0, quality: getQuality() });
  const perf = useRef({ last: 0, avg: 16, frames: 0 });

  /**
   * Make the WebGL globe once, when the first moment is queued, so shader compilation hides in the pause
   * before the first frame. The land texture is asked for either way: the dotted fallback needs it too.
   */
  const ensureGlobe = useCallback(() => {
    if (!landAsked.current) {
      landAsked.current = true;
      void loadLand().then(img => {
        land.current = img;
        gl.current?.setLand(img);
      });
    }
    if (gl.current || glFailed.current || !glCanvas.current) return;
    const g = GlobeGL.create(glCanvas.current);
    if (!g) { glFailed.current = true; return; }
    gl.current = g;
    if (land.current) g.setLand(land.current);
  }, []);

  /** Size the overlay canvas to the screen. (The globe canvas is sized by the renderer each frame.) */
  const fit = useCallback(() => {
    const root = rootRef.current, c = ovCanvas.current;
    if (!root || !c) return;
    const w = root.clientWidth, h = root.clientHeight;
    const q = getQuality();
    const cap = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, MAX_SCALE[q]);
    const prev = size.current;
    // the adaptive scale only ever moves down from the cap; a new cap (quality or screen change) starts over
    const scale = prev.cap === cap && prev.scale > 0 ? Math.min(prev.scale, cap) : cap;
    size.current = { w, h, scale, cap, quality: q };
    const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  }, []);

  /** The overlay scene for the playing moment, built once per moment. */
  const sceneFor = (id: number, p: WorldPayload): OverlayScene => {
    if (scene.current?.id === id) return scene.current.scene;
    let s: OverlayScene;
    if (p.kind === 'major') {
      const m = p.major;
      s = {
        mode: 'major',
        to: { lat: m.lat, lon: m.lon, precision: m.precision, marker: m.marker, name: m.name },
        prev: p.previous && p.previous.precision !== 'unlocated' && !p.first ? { lat: p.previous.lat, lon: p.previous.lon, name: p.previous.name } : null,
        alsoAt: m.alsoAt ?? [],
        dots: p.foundBefore.filter(x => x.precision !== 'unlocated' && x.id !== m.id).map(x => ({ lat: x.lat, lon: x.lon })),
        eraPoints: [],
      };
    } else {
      s = { mode: 'era', to: null, prev: null, alsoAt: [], dots: [], eraPoints: p.points.filter(x => x.precision !== 'unlocated').map(x => ({ lat: x.lat, lon: x.lon })) };
    }
    scene.current = { id, scene: s };
    return s;
  };

  /** One frame. */
  const draw = useCallback((now: number, s: Sample<WorldPayload> | null) => {
    const root = rootRef.current;
    if (!root) return;
    if (!s) { root.dataset.on = 'false'; return; }
    root.dataset.on = 'true';
    if (size.current.w === 0) fit();
    const { w, h } = size.current;
    if (w === 0 || h === 0) return;
    const f = s.frame;
    const p = s.moment.payload;
    const flat = p.flat;

    // adaptive resolution: if frames are slow, spend fewer pixels
    const pf = perf.current;
    if (pf.last) {
      const dt = now - pf.last;
      pf.avg = pf.avg * 0.9 + Math.min(dt, 100) * 0.1;
      if (++pf.frames % 24 === 0 && pf.avg > 30 && size.current.scale > 0.65) { size.current.scale = Math.max(0.65, size.current.scale * 0.8); fit(); }
    }
    pf.last = now;

    // the scrim and the card
    if (scrimRef.current) scrimRef.current.style.opacity = String((flat ? 0.94 : 0.5) * f.veil);
    const card = cardRef.current;
    if (card) {
      const a = p.kind === 'era' ? f.title : f.card;
      card.style.opacity = String(a);
      card.style.transform = `translate3d(0, ${((1 - a) * 14).toFixed(1)}px, 0)`;
    }
    const showHint = s.canSkip && !s.skipping ? 1 : 0;
    if (hintRef.current) hintRef.current.style.opacity = String(showHint * f.veil * 0.9);
    if (skipRef.current) skipRef.current.style.opacity = String(showHint * f.veil);

    if (flat) {
      const ctx = ovCanvas.current?.getContext('2d');
      ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    const glow = ERA_GLOW[p.kind === 'era' ? p.era : p.major.era] ?? DEFAULT_GLOW;
    const n = p.kind === 'era' ? Math.max(1, p.points.length) : 1;
    const lift = p.kind === 'era' ? clamp(f.light / n, 0, 1) * (0.5 + 0.5 * f.title) * f.veil : 0;
    const vp = { w, h };
    const sc = sceneFor(s.moment.id, p);
    const g = gl.current;
    const ctx = ovCanvas.current?.getContext('2d') ?? null;
    if (ctx) ctx.setTransform(size.current.scale, 0, 0, size.current.scale, 0, 0);
    const style: OverlayStyle = { ...DEFAULT_STYLE, quality: size.current.quality };

    if (g && !g.lost) {
      g.resize(w, h, size.current.scale);
      g.draw({ cam: f.cam, vp, veil: f.veil, time: now / 1000, lift, tint: glow, detail: size.current.quality === 'low' ? 0.3 : size.current.quality === 'medium' ? 0.65 : 1 });
      if (ctx) drawOverlay(ctx, vp, f.cam, f, sc, style);
    } else if (ctx) {
      // no WebGL (or it was lost): the same globe drawn on the CPU at a fraction of the size, and the same markers
      if (!soft.current) soft.current = new SoftGlobe();
      const cell = size.current.quality === 'high' ? 3 : size.current.quality === 'medium' ? 4 : 6;
      const globe = soft.current.render(vp, f.cam, sdfFromImage(land.current), cell, lift, glow);
      drawFallbackGlobe(ctx, vp, f.cam, f.veil, globe);
      drawOverlay(ctx, vp, f.cam, f, sc, style, false);
    }

    if (glowRef.current) glowRef.current.style.opacity = String(p.kind === 'era' ? lift * 0.55 : 0);
  }, [fit]);

  // the clock
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      raf = 0;
      director.tick(t);
      draw(t, director.sample(t));
      if (director.busy) raf = requestAnimationFrame(loop);
      else draw(t, null);
    };
    const kick = () => {
      if (director.busy) ensureGlobe();
      if (!raf && director.busy) raf = requestAnimationFrame(loop);
    };
    const un = director.subscribe(kick);
    kick();
    return () => { un(); if (raf) cancelAnimationFrame(raf); };
  }, [director, draw, ensureGlobe]);

  // keep the canvases the size of the screen
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof ResizeObserver === 'undefined') { fit(); return; }
    const ro = new ResizeObserver(() => fit());
    ro.observe(root);
    fit();
    return () => ro.disconnect();
  }, [fit]);

  // free the GPU when the page goes
  useEffect(() => () => { gl.current?.dispose(); gl.current = null; }, []);

  // skipping: Space or Enter (this moment), Escape (this moment and everything queued)
  useEffect(() => {
    const doSkip = (all: boolean) => {
      const did = director.skip(performance.now(), all);
      if (did) onSkip?.(all);
      return did;
    };
    const onKey = (ev: KeyboardEvent) => {
      if (!director.playing) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key;
      if (k !== ' ' && k !== 'Enter' && k !== 'Escape' && k !== 'Spacebar') return;
      // the globe is on top: these keys are for it, whatever has focus underneath
      ev.preventDefault(); ev.stopImmediatePropagation();
      doSkip(k === 'Escape');
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      // a button that had focus would otherwise "click" on Space's key-up
      if (director.playing && (ev.key === ' ' || ev.key === 'Spacebar')) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKeyUp, true); };
  }, [director, onSkip]);

  const onClick = () => {
    if (director.skip(performance.now(), false)) onSkip?.(false);
  };

  const major = payload?.kind === 'major' ? payload : null;
  const era = payload?.kind === 'era' ? payload : null;

  return (
    <>
      <div className="sr" role="status" aria-live="polite">{announcement(payload)}</div>
      <div ref={rootRef} className="wg" data-on="false" data-kind={payload?.kind ?? 'none'} onClick={onClick} aria-hidden={payload ? undefined : true}>
        <div ref={scrimRef} className="wg-scrim" style={{ opacity: 0 }} />
        <canvas ref={glCanvas} className="wg-canvas" aria-hidden="true" />
        <canvas ref={ovCanvas} className="wg-canvas" aria-hidden="true" />
        <div ref={glowRef} className="wg-glow" style={{ opacity: 0 }} aria-hidden="true" />

        {major && <MajorCard key={current!.id} innerRef={cardRef} p={major} />}
        {era && <EraCard key={current!.id} innerRef={cardRef} p={era} />}

        <button ref={skipRef} type="button" className="wg-skip mono" style={{ opacity: 0 }}
          onClick={e => { e.stopPropagation(); onClick(); }} aria-label="Skip this scene">Skip</button>
        <div ref={hintRef} className="wg-hint mono" style={{ opacity: 0 }} aria-hidden="true">
          Click or press Space to skip · Esc skips all
        </div>
      </div>
    </>
  );
}

function MajorCard({ p, innerRef }: { p: MajorPayload; innerRef: React.RefObject<HTMLDivElement | null> }) {
  const m = p.major;
  const note = CERTAINTY_NOTE[m.certainty];
  const kicker = p.inspect ? 'World origins' : p.first ? 'First major invention' : 'Major invention';
  const who = [m.period, m.civ].filter(Boolean).join(' · ');
  return (
    <div ref={innerRef} className="wg-card" data-tier={p.tier} style={{ opacity: 0 }}>
      <p className="wg-kicker mono"><i className="wg-pip" aria-hidden="true" />{kicker}</p>
      <h2 className="wg-name">{m.name}</h2>
      <p className="wg-where mono">{m.region}</p>
      <p className="wg-when mono">{who}</p>
      {note && <p className="wg-note mono">{note}</p>}
      <p className="wg-fact">{m.fact}</p>
      <div className="wg-foot mono">
        <span>{p.eraRequired ? `${p.eraRequired.done} / ${p.eraRequired.required} required · ${p.eraRequired.eraName}` : m.hidden ? 'Hidden major' : 'Optional major'}</span>
        <span>{p.inspect ? 'From your archive' : `Registered · ${p.registered} / ${p.total}`}</span>
      </div>
    </div>
  );
}

function EraCard({ p, innerRef }: { p: EraPayload; innerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={innerRef} className="wg-card wg-era" style={{ opacity: 0 }}>
      <p className="wg-kicker mono"><i className="wg-pip" aria-hidden="true" />Era complete</p>
      <h2 className="wg-name wg-era-name">{p.eraName}</h2>
      <i className="wg-rule" aria-hidden="true" />
      {p.blurb && <p className="wg-fact">{p.blurb}</p>}
      <p className="wg-next mono">
        {p.next ? <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0" /></svg>Unlocked · {p.next.name}</> : 'The last era is complete'}
      </p>
      <div className="wg-foot mono">
        <span>{p.required} / {p.required} required inventions</span>
        <span>{p.regionsRepresented} / {p.regionsTotal} regions</span>
      </div>
    </div>
  );
}
