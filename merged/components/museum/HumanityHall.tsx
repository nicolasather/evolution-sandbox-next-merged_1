'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Catalog } from '@/lib/museum/history/data';
import { lineage } from '@/lib/museum/history/selectors';
import { museumStore } from '@/lib/museum/history/store';
import { formatYear, shortYear } from '@/lib/museum/history/timeline';
import type { HistoricalExhibit, Year } from '@/lib/museum/history/types';
import { MotifArt } from './MotifArt';
import { PORTAL_W, type HallGallery, type HallItem, type HallLayout, type Row } from './layout';

/* ============================================================================
   THE HUMANITY HALL — one continuous, walkable corridor through history.

   Not a grid: displays stand in space (cases on the walls, objects on
   plinths, things suspended in light, monumental installations in their own
   bays) along a corridor whose rooms change material and light as history
   advances. The canonical timeline ends at a line of light on the floor;
   beyond it the corridor continues into darkness — sealed rooms, anonymous
   silhouettes, never a name or a date.

   Movement: wheel / trackpad, drag, ← →, or the rail at the bottom. The
   camera, parallax layers and the drawing-in of each display as it comes
   into view are driven from one requestAnimationFrame loop, writing
   transforms directly (no React render per frame).
   ========================================================================== */

/** Vertical centre of each row, as a fraction of the hall's height. */
export const ROW_Y: Record<Row, number> = { bay: 0.45, air: 0.3, floor: 0.53, upper: 0.36, lower: 0.63 };

/** Long journeys through history are compressed: the camera cuts to about one
 *  screen away and glides the rest, rather than scrolling through every room. */
function aim(c: { x: number; t: number }, t: number, w: number) {
  c.t = t;
  const d = t - c.x;
  if (Math.abs(d) > w * 3) c.x = t - Math.sign(d) * w * 1.2;
}

export interface HallTarget { id?: string; x?: number; key: number; instant?: boolean }

const PLAQUE_SHIFT = 0.33;   // the focused display sits a third of the way in; its plaque takes the right side

const Display = memo(function Display({ item, isNew, focused, dim, onFocus }: {
  item: HallItem; isNew: boolean; focused: boolean; dim: boolean; onFocus: (id: string) => void;
}) {
  const e = item.exhibit;
  const style = { left: item.x, '--near': item.nearness.toFixed(2), '--hue': item.hue } as CSSProperties;
  const cls = `xd f-${item.form} r-${item.row} ch-${e.display.choreography ?? 'assemble'}`
    + (focused ? ' is-focused' : '') + (dim ? ' is-dim' : '') + (isNew ? ' is-new' : '');
  if (!item.available) {
    return (
      <div className={cls + ' is-locked'} style={style} aria-hidden="true" data-x={item.x}>
        <span className="xd-light" />
        {item.form === 'suspended' && <span className="xd-cable" />}
        <span className="xd-sil" />
        <span className="xd-base" />
      </div>
    );
  }
  return (
    <button type="button" className={cls} style={style} data-id={e.id} data-x={item.x}
      aria-label={`${e.title}, ${e.when.display}`} onClick={() => onFocus(e.id)}>
      <span className="xd-light" />
      {item.form === 'suspended' && <span className="xd-cable" />}
      {item.form === 'monument' && <span className="xd-shaft" />}
      <span className="xd-obj"><MotifArt motif={e.display.motif} /></span>
      <span className="xd-base" />
      <span className="xd-plaque">
        <b>{e.title}</b>
        <i className="mono">{e.when.display.length > 34 ? shortYear(e.when.anchor ?? e.when.from) : e.when.display}</i>
      </span>
      {isNew && <span className="xd-new" aria-hidden="true" />}
    </button>
  );
});

function Portal({ g }: { g: HallGallery }) {
  const open = g.status === 'open';
  const style = { left: g.x0, width: PORTAL_W, '--near': g.nearness.toFixed(2) } as CSSProperties;
  return (
    <div className={`hh-portal is-${g.status}`} style={style} aria-hidden={!open}>
      <span className="hh-portal-frame" />
      <span className="hh-portal-door l" />
      <span className="hh-portal-door r" />
      <span className="hh-portal-glow" />
      {open && (
        <span className="hh-portal-text">
          <span className="mono hh-portal-num">{String(g.index + 1).padStart(2, '0')}</span>
          <span className="hh-portal-title">{g.gallery.title}</span>
          <span className="hh-portal-epi">{g.gallery.epigraph}</span>
          <span className="mono hh-portal-span">{shortYear(g.gallery.span.from)} — {g.gallery.span.to >= 2020 ? 'today' : shortYear(g.gallery.span.to)}</span>
        </span>
      )}
    </div>
  );
}

export function HumanityHall({
  cat, year, layout, focusId, onFocus, target, active, storeVersion, story,
}: {
  cat: Catalog;
  year: Year;
  layout: HallLayout;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  target: HallTarget | null;
  active: boolean;
  storeVersion: number;
  /** The story tour is steering the camera: user scrolling is still allowed but pauses nothing. */
  story?: boolean;
}) {
  void storeVersion;
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const railViewRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const cam = useRef({ x: 0, t: 0, drag: false, lastX: 0, v: 0 });
  const storyRef = useRef(!!story);
  useEffect(() => { storyRef.current = !!story; }, [story]);
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);
  const maxX = Math.max(0, layout.width - size.w * 0.5);

  // measure
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const m = () => setSize({ w: el.clientWidth || 1200, h: el.clientHeight || 700 });
    m();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // first arrival: stand just before the frontier, looking at the most recent history
  const placed = useRef(false);
  useEffect(() => {
    if (!active || placed.current || size.w < 100) return;
    placed.current = true;
    const x = Math.max(0, layout.frontierX - size.w * 0.72);
    cam.current.x = cam.current.t = x;
  }, [active, size.w, layout.frontierX]);

  // jumps requested from outside (rail, tour, "show in hall", focus)
  useEffect(() => {
    if (!target) return;
    const item = target.id ? layout.byId.get(target.id) : undefined;
    const x = item ? item.x - sizeRef.current.w * (focusId === target.id && !story ? PLAQUE_SHIFT : 0.5) : target.x ?? cam.current.t;
    aim(cam.current, Math.max(0, Math.min(maxX, x)), sizeRef.current.w);
    if (target.instant) cam.current.x = cam.current.t;
  }, [target?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusId) return;
    const item = layout.byId.get(focusId);
    if (!item) return;
    aim(cam.current, Math.max(0, Math.min(maxX, item.x - sizeRef.current.w * (story ? 0.5 : PLAQUE_SHIFT))), sizeRef.current.w);
  }, [focusId, layout, maxX, story]);

  // the frame loop
  const pendingReveal = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let lastFlush = 0;
    let lastGallery = -1;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const items = worldRef.current ? Array.from(worldRef.current.querySelectorAll<HTMLElement>('.xd')) : [];
    const tick = (t: number) => {
      const c = cam.current;
      c.t = Math.max(0, Math.min(maxX, c.t));
      c.x += (c.t - c.x) * (reduced ? 1 : 0.085);
      if (Math.abs(c.t - c.x) < 0.3) c.x = c.t;
      const x = c.x;
      const w = sizeRef.current.w;
      if (worldRef.current) worldRef.current.style.transform = `translate3d(${-x}px,0,0)`;
      if (farRef.current) farRef.current.style.transform = `translate3d(${-x * 0.35}px,0,0)`;
      if (nearRef.current) nearRef.current.style.transform = `translate3d(${-x * 1.45}px,0,0)`;
      if (bandRef.current) bandRef.current.style.transform = `translate3d(${-x}px,0,0)`;
      stageRef.current?.style.setProperty('--cam', `${x}px`);
      if (railViewRef.current) {
        railViewRef.current.style.left = `${(x / layout.width) * 100}%`;
        railViewRef.current.style.width = `${Math.max(1, (w / layout.width) * 100)}%`;
      }
      // which room are we in: its light becomes the ambient light of the whole hall
      const mid = x + w * 0.5;
      const gi = layout.galleries.findIndex(g => mid >= g.x0 && mid < g.x1);
      if (gi !== lastGallery && gi >= 0 && stageRef.current) {
        lastGallery = gi;
        const g = layout.galleries[gi];
        stageRef.current.style.setProperty('--room-hue', String(g.gallery.hue));
        stageRef.current.style.setProperty('--room-lit', (0.25 + 0.75 * (gi / Math.max(1, layout.galleries.length - 1))).toFixed(3));
        stageRef.current.dataset.arch = g.gallery.architecture;
        stageRef.current.dataset.status = g.status;
      }
      // draw displays in as they come into view; note what has been shown
      for (const el of items) {
        const ex = Number(el.dataset.x);
        const inView = ex > x - 200 && ex < x + w + 200;
        if (inView && !el.classList.contains('in')) {
          el.classList.add('in');
          const id = el.dataset.id;
          if (id && !museumStore.state(id).revealedAt) pendingReveal.current.add(id);
        }
      }
      if (pendingReveal.current.size && t - lastFlush > 1200) {
        lastFlush = t;
        const ids = [...pendingReveal.current];
        pendingReveal.current.clear();
        museumStore.markRevealed(ids);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, layout, maxX]);

  // input: wheel, drag, keys, pointer parallax
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !active) return;
    const c = cam.current;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.xf')) return;          // the plaque scrolls itself
      e.preventDefault();
      c.t += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.1;
    };
    let startX = 0, moved = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.xf, .hh-rail, button')) return;
      c.drag = true; startX = c.lastX = e.clientX; moved = 0;
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      el.style.setProperty('--px', `${e.clientX - r.left}px`);
      el.style.setProperty('--py', `${e.clientY - r.top}px`);
      if (!c.drag) return;
      const dx = e.clientX - c.lastX;
      c.lastX = e.clientX;
      moved = Math.abs(e.clientX - startX);
      c.t -= dx * 1.4;
      c.x = c.t;
    };
    const up = () => { c.drag = false; void moved; };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('.cg, .mr-overlay') || storyRef.current) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); c.t += sizeRef.current.w * 0.45; }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); c.t -= sizeRef.current.w * 0.45; }
      else if (e.key === 'Home') { e.preventDefault(); c.t = 0; }
      else if (e.key === 'End') { e.preventDefault(); c.t = layout.frontierX - sizeRef.current.w * 0.72; }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key);
    };
  }, [active, layout.frontierX]);

  // relation lines for the focused display: what came before (left) and what grew from it (right)
  const lines = useMemo(() => {
    if (!focusId) return null;
    const me = layout.byId.get(focusId);
    if (!me) return null;
    const l = lineage(cat, focusId, year, 3);
    const out: { d: string; kind: 'before' | 'after'; gen: number; id: string }[] = [];
    const H = size.h;
    const y0 = ROW_Y[me.row] * H;
    const add = (list: HistoricalExhibit[][], kind: 'before' | 'after') => {
      list.forEach((gen, gi) => gen.forEach(e => {
        const it = layout.byId.get(e.id);
        if (!it || !it.available) return;
        const y1 = ROW_Y[it.row] * H;
        const lift = Math.min(H * 0.26, 60 + Math.abs(it.x - me.x) * 0.05);
        const top = Math.min(y0, y1) - lift;
        out.push({ d: `M${me.x} ${y0}C${me.x} ${top} ${it.x} ${top} ${it.x} ${y1}`, kind, gen: gi, id: e.id });
      }));
    };
    add(l.before, 'before');
    add(l.after, 'after');
    return out;
  }, [focusId, cat, year, layout, size.h]);
  const related = useMemo(() => new Set(lines?.map(l => l.id) ?? []), [lines]);

  const onDisplay = useCallback((id: string) => onFocus(id), [onFocus]);

  const exhibitsState = museumStore.get().exhibits;

  return (
    <div className={'hh' + (focusId ? ' is-focus' : '') + (story ? ' is-story' : '')} ref={stageRef}
      style={{ ['--hall-h' as string]: `${size.h}px` } as CSSProperties}
      onClick={e => {
        if (focusId && !(e.target as HTMLElement).closest('.xd, .xf, .hh-rail, button')) onFocus(null);
      }}>
      <div className="hh-sky" aria-hidden="true" />
      <div className="hh-far" ref={farRef} aria-hidden="true" style={{ width: layout.width * 0.35 + size.w }}>
        {layout.galleries.map(g => (
          <span key={g.gallery.id} className={`hh-far-room arch-${g.gallery.architecture} is-${g.status}`}
            style={{ left: g.x0 * 0.35, width: (g.x1 - g.x0) * 0.35, ['--hue' as string]: g.gallery.hue, ['--near' as string]: g.nearness } as CSSProperties} />
        ))}
      </div>
      <div className="hh-floor" aria-hidden="true" />
      <div className="hh-spot" aria-hidden="true" />

      <div className="hh-world" ref={worldRef} style={{ width: layout.width }}>
        {layout.galleries.map(g => (
          <section key={g.gallery.id} className={`hh-room arch-${g.gallery.architecture} is-${g.status}`}
            aria-label={g.status === 'open' ? g.gallery.title : undefined} aria-hidden={g.status !== 'open'}
            style={{
              left: g.x0, width: g.x1 - g.x0, ['--hue' as string]: g.gallery.hue, ['--near' as string]: g.nearness.toFixed(2),
              ['--lit' as string]: (0.25 + 0.75 * (g.index / Math.max(1, layout.galleries.length - 1))).toFixed(3),
            } as CSSProperties}>
            <span className="hh-wall" />
            <span className="hh-ceiling" />
            <span className="hh-trim" />
            {g.status !== 'open' && <span className="hh-fog" />}
          </section>
        ))}
        {layout.galleries.map(g => <Portal key={g.gallery.id} g={g} />)}
        {lines && (
          <svg className="hh-lines" width={layout.width} height={size.h} aria-hidden="true">
            {lines.map((l, i) => (
              <path key={i} d={l.d} pathLength={1} className={`hh-line ${l.kind} g${l.gen}`} style={{ ['--i' as string]: i } as CSSProperties} />
            ))}
          </svg>
        )}
        {layout.items.map(item => (
          <Display key={item.exhibit.id} item={item}
            isNew={item.available && !exhibitsState[item.exhibit.id]?.revealedAt}
            focused={focusId === item.exhibit.id}
            dim={!!focusId && focusId !== item.exhibit.id && !related.has(item.exhibit.id)}
            onFocus={onDisplay} />
        ))}
        <div className="hh-frontier" style={{ left: layout.frontierX + 60 }}>
          <span className="hh-frontier-line" />
          <span className="hh-frontier-text">
            <span className="mono">Humanity&rsquo;s timeline</span>
            <b>{formatYear(year)}</b>
            <span className="hh-frontier-sub">History continues beyond this light.</span>
          </span>
        </div>
      </div>

      <div className="hh-near" ref={nearRef} aria-hidden="true" style={{ width: layout.width * 1.45 + size.w }} />

      <div className="hh-band" aria-hidden="true">
        <div className="hh-band-track" ref={bandRef} style={{ width: layout.width }}>
          {layout.galleries.filter(g => g.status === 'open').map(g => (
            <span key={g.gallery.id} className="hh-tick major" style={{ left: g.x0 + PORTAL_W * 0.5 }}>
              <i className="mono">{shortYear(g.gallery.span.from)}</i>
            </span>
          ))}
          {layout.items.filter(it => it.available && it.form !== 'vitrine').map(it => (
            <span key={it.exhibit.id} className="hh-tick" style={{ left: it.x }}>
              <i className="mono">{shortYear(it.exhibit.when.anchor ?? it.exhibit.when.from)}</i>
            </span>
          ))}
          <span className="hh-tick now" style={{ left: layout.frontierX + 60 }}><i className="mono">{shortYear(year)}</i></span>
        </div>
      </div>

      <nav className="hh-rail" aria-label="Galleries">
        <div className="hh-rail-track">
          {layout.galleries.map(g => (
            <button key={g.gallery.id} type="button" className={`hh-rail-seg is-${g.status}`}
              style={{ left: `${(g.x0 / layout.width) * 100}%`, width: `${((g.x1 - g.x0) / layout.width) * 100}%`, ['--hue' as string]: g.gallery.hue, ['--near' as string]: g.nearness } as CSSProperties}
              disabled={g.status !== 'open'}
              aria-label={g.status === 'open' ? `Go to ${g.gallery.title}` : 'Sealed gallery'}
              title={g.status === 'open' ? g.gallery.title : undefined}
              onClick={e => { e.stopPropagation(); cam.current.t = g.x0 - 40; onFocus(null); }}>
              <span />
            </button>
          ))}
          <span className="hh-rail-now" style={{ left: `${((layout.frontierX + 60) / layout.width) * 100}%` }} />
          <span className="hh-rail-view" ref={railViewRef} />
        </div>
      </nav>
    </div>
  );
}
