'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Glyph } from './Glyph';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';
import { sortDiscoveries } from '@/lib/chronology';
import { cn } from '@/lib/utils';

/* ============================================================================
   TIMELINE — the same discoveries, laid out along real chronology.

   ONE global rail, oldest to newest, built from the central comparator
   (lib/chronology.ts) rather than one column per era. Era grouping used to
   run first and dates only inside it, which quietly claimed every entry of
   one era predates every entry of the next — false for Agriculture,
   Settlement, Trade and several others, which overlap in real history. Era
   names now appear as subtle inline dividers wherever the sequence actually
   crosses into a different era (which, honestly, can happen more than once
   for the same era if the record interleaves), never as a column boundary
   that reorders anything.

   A find you have made stands on the rail with its name and its real date
   (the `date` field, exactly as recorded); entries you have not found are
   unnamed ticks, so the rail shows how much is still ahead without saying
   what. The spacing between points is ordinal, not to scale — deep time and
   the last two centuries cannot share one linear axis.

   PERFORMANCE — the rail is long: a full playthrough puts well over a
   thousand discoveries on it. Rendering every one of them at once means
   thousands of DOM nodes, thousands of inline SVG glyphs and hundreds of
   blurred cards, all of which the compositor has to keep alive while the
   player scrolls. So the rail is VIRTUALIZED: only the points around the
   viewport exist in the DOM, and the space the missing ones would have
   taken is preserved by two spacer bars, so the scroll geometry (and every
   offset the rail is measured by) is byte-for-byte the same as before.
   Scroll reads are quantised so React re-renders when the window moves,
   not on every frame, and every scroll write goes through requestAnimationFrame.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   Layout constants. These mirror app/_museum.css (section 8): the rail's
   geometry is computed here so that a point's position is known without
   asking the DOM for it (no forced synchronous layout while scrolling).
   --------------------------------------------------------------------------- */
const ERA_PAD_RIGHT = 44;          // .tl-era padding-right
const ERA_MIN_WIDTH = 120;         // .tl-era min-width
const SCROLL_PAD_LEFT = 40;        // .tl-scroll padding-left (wide)
const SCROLL_PAD_LEFT_NARROW = 22; // .tl-scroll padding-left (<=900px)
const PT_WIDTH = 104;              // .tl-pt width (wide)
const PT_WIDTH_NARROW = 92;        // .tl-pt width (<=900px)
const PT_AHEAD_WIDTH = 26;         // .tl-pt.ahead width
const OVERSCAN = 480;              // px of rail kept alive either side of the viewport
const SCROLL_QUANTUM = 160;        // px of scrolling per React update
const FALLBACK_VIEWPORT = 1400;    // used before the scroller can be measured

/** Is the narrow (<=900px) timeline layout in effect? */
function narrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try { return window.matchMedia('(max-width:900px)').matches; } catch { return false; }
}

interface Run { eraId: string; name: string; required: number; requiredDone: number; startIndex: number; found: number; ahead: number }
interface Row { items: (Discovery | null)[]; majorAt: boolean[]; runs: Run[]; foundCount: number; ahead: number }

/** One laid-out point on the rail: where it starts (px from the left edge of
 *  the scroll content) and how wide it is. */
interface Point { n: Discovery | null; major: boolean; x: number; w: number; idx: number; local: number }

/** One era run, with its points laid out along the rail. */
interface EraLayout { run: Run; pts: Point[]; startX: number; inner: number; width: number }

/* A found point, memoised: scrolling the rail re-renders the window, but a
   point that did not change must not re-render with it. */
const RailPoint = memo(function RailPoint({
  n, major, idx, local, sel, onOpen,
}: {
  n: Discovery; major: boolean; idx: number; local: number; sel: boolean;
  onOpen: { current: (id: string) => void };
}) {
  return (
    <li className={cn('tl-pt', local % 2 ? 'dn' : 'up', sel && 'sel', major && 'major')}
        data-id={n.id} data-idx={idx} style={{ ['--i' as string]: Math.min(local, 24) }}>
      <button onClick={() => onOpen.current(n.id)} aria-label={`${n.n}, ${n.date}${major ? ', major world invention' : ''}`}>
        <span className="tl-card">
          <Glyph node={n} />
          <span className="tl-name">{n.n}</span>
          <span className="tl-date mono">{n.date}</span>
          {major && <span className="tl-flag mono">World milestone</span>}
        </span>
        <span className="tl-stem" />
        <span className={cn('tl-dot', `r-${n.rar}`)} />
        <span className="tl-rank-badge" aria-label="Player rank link to leaderboard" title="Link to leaderboard">
          <a href="/quiz/rank" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontSize: 10, letterSpacing: '.05em' }}>#Rank</a>
        </span>
      </button>
    </li>
  );
});

export function TimelineView({
  engine, version, active, focusId, onOpen,
}: {
  engine: Engine; version: number; active: boolean; focusId: string | null; onOpen: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  /* the scroll window: how far along the rail we are (quantised), how wide the
     viewport is, and which breakpoint we are at. */
  const [vp, setVp] = useState(() => ({ left: 0, w: 0, narrow: narrowViewport() }));
  /* the entrance animation only plays while the view is opening */
  const [entering, setEntering] = useState(false);

  const row = useMemo<Row>(() => {
    const all = sortDiscoveries(
      engine.db.nodes.filter(n => !(n.hidden && !engine.has(n.id))), // hidden finds stay hidden until found
    );
    const items = all.map(n => (engine.has(n.id) ? n : null));
    const majorAt = all.map(n => engine.isMajor(n.id));
    // era dividers: a new one starts whenever the era actually changes along
    // the real chronological sequence — not once per era, but once per
    // contiguous run of it, which is what "overlapping eras" looks like here.
    const runs: Run[] = [];
    all.forEach((n, i) => {
      if (i === 0 || all[i - 1].era !== n.era) {
        const p = engine.eraProgress(n.era);
        const name = engine.db.eras.find(e => e.id === n.era)?.name ?? n.era;
        runs.push({ eraId: n.era, name, required: p.required, requiredDone: p.requiredDone, startIndex: i, found: 0, ahead: 0 });
      }
    });
    runs.forEach((run, ri) => {
      const end = runs[ri + 1]?.startIndex ?? items.length;
      let found = 0;
      for (let i = run.startIndex; i < end; i++) if (items[i]) found++;
      run.found = found;
      run.ahead = end - run.startIndex - found;
    });
    const foundCount = items.filter(Boolean).length;
    return { items, majorAt, runs, foundCount, ahead: items.length - foundCount };
    // version: the rail fills in as the player finds more
  }, [engine, version]); // eslint-disable-line react-hooks/exhaustive-deps

  /* the rail's geometry, computed once per fill — no DOM reads, so the
     scroll position of any point is known without forcing layout. */
  const layout = useMemo<{ eras: EraLayout[]; total: number }>(() => {
    const narrow = vp.narrow;
    const wFound = narrow ? PT_WIDTH_NARROW : PT_WIDTH;
    let x = narrow ? SCROLL_PAD_LEFT_NARROW : SCROLL_PAD_LEFT;
    const eras: EraLayout[] = [];
    row.runs.forEach((run, ri) => {
      const end = row.runs[ri + 1]?.startIndex ?? row.items.length;
      const nodes = row.items.slice(run.startIndex, end);
      const majors = row.majorAt.slice(run.startIndex, end);
      let inner = 0;
      const pts: Point[] = nodes.map((n, i) => {
        const w = n ? wFound : PT_AHEAD_WIDTH;
        const px = x + inner;
        inner += w;
        return { n, major: !!majors[i], x: px, w, idx: run.startIndex + i, local: i };
      });
      const width = Math.max(ERA_MIN_WIDTH, inner + ERA_PAD_RIGHT);
      eras.push({ run, pts, startX: x, inner, width });
      x += width;
    });
    return { eras, total: x };
  }, [row, vp.narrow]);

  /* measure the scroller: the viewport width comes from a ResizeObserver (so
     scrolling never has to read layout), and the scroll offset is quantised so
     React re-renders when the window moves rather than on every frame. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    let width = el.clientWidth || 0;
    let lastLeft = -1;
    let lastNarrow = narrowViewport();
    let lastWidth = width;
    const measure = () => {
      raf = 0;
      const narrow = narrowViewport();
      const left = Math.round(el.scrollLeft / SCROLL_QUANTUM) * SCROLL_QUANTUM;
      if (left === lastLeft && narrow === lastNarrow && width === lastWidth) return;
      lastLeft = left; lastNarrow = narrow; lastWidth = width;
      setVp({ left, w: width, narrow });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { width = el.clientWidth || width; schedule(); });
      ro.observe(el);
    }
    measure();
    return () => {
      el.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* the entrance animation plays once, when the view opens */
  useEffect(() => {
    if (!active) { setEntering(false); return; }
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 700);
    return () => clearTimeout(t);
  }, [active]);

  // first time it opens: bring the latest find into view
  useEffect(() => {
    if (!active || placed.current) return;
    const el = scroller.current;
    if (!el) return;
    if (!vp.w) return;                 // wait for the first real measurement
    placed.current = true;
    let lastIndex = -1;
    row.items.forEach((n, i) => { if (n) lastIndex = i; });
    if (lastIndex < 0) return;
    for (const era of layout.eras) {
      const p = era.pts[lastIndex - era.run.startIndex];
      if (!p) continue;
      const target = Math.max(0, p.x - 80);
      requestAnimationFrame(() => { el.scrollLeft = target; });
      return;
    }
  }, [active, vp.w, layout, row]);

  // a vertical wheel scrolls the rail sideways — coalesced via rAF + passive:false
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    let pendingDelta = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      pending