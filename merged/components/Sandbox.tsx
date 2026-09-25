'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Landing } from './Landing';
import { TopBar } from './TopBar';
import { InventoryRail } from './InventoryRail';
import { Bench } from './Bench';
import { ExhibitPanel } from './ExhibitPanel';
import { Ending } from './Ending';
import { Glyph } from './Glyph';
import { ConfirmDialog } from './ConfirmDialog';
import { JournalPanel } from './JournalPanel';
import { SceneBackdrop } from './SceneBackdrop';
import { ReactiveField } from './fx/ReactiveField';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { ViewVeil } from './fx/ViewVeil';
import { EraShift } from './fx/EraShift';
import { QuestionCard } from './QuestionCard';
import { NarratorView } from './Narrator';
import { Narrator } from '@/lib/narrator/narrator';
import { Tutor } from '@/lib/learn/tutor';
import { ContextMenu, type ContextMenuTarget } from './fx/ContextMenu';
import { ShortcutsOverlay } from './fx/ShortcutsOverlay';
import { enterFullscreen, installImmersiveTop, installPressFx } from '@/lib/fx';
import { benchElement, benchSpawn } from '@/lib/craft/bus';
import { sound } from '@/lib/sound';
import { ERA_TINT, useSandbox } from '@/lib/useSandbox';
import { cn } from '@/lib/utils';
import type { ViewId } from '@/lib/types';

const GraphView = dynamic(() => import('./GraphView').then(mod => mod.GraphView), { ssr: false });
const TimelineView = dynamic(() => import('./TimelineView').then(mod => mod.TimelineView), { ssr: false });
const ArchiveView = dynamic(() => import('./ArchiveView').then(mod => mod.ArchiveView), { ssr: false });

export function Sandbox() {
  const [panelOpen, setPanelOpen] = useState(false);
  const s = useSandbox();
  const { engine, version, view, setView, open, clearSlots, setEnding, reset } = s;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [onlyPath, setOnlyPath] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [replay, setReplay] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuTarget | null>(null);
  const panelReturn = useRef<HTMLElement | null>(null);
  /** The corner questions: when one appears, which one, and what it opens. */
  const [tutor] = useState(() => new Tutor(Math.random, Date.now()));
  /** The voice of the era: welcomes an era, marks the weighty finds, nudges when stuck. */
  const [narrator] = useState(() => new Narrator(Math.random, Date.now()));

  /* The film is over → the interface loads into existence, one layer at a
     time (see the WORLD REVEAL block in _museum.css). 6 is the finished state. */
  const [introDone, setIntroDone] = useState(false);
  const [reveal, setReveal] = useState(0);
  const revealTimers = useRef<number[]>([]);
  const stage = useCallback((steps: [number, number][]) => {
    revealTimers.current.forEach(t => window.clearTimeout(t));
    revealTimers.current = steps.map(([n, ms]) => window.setTimeout(() => setReveal(n), ms));
  }, []);
  useEffect(() => () => revealTimers.current.forEach(t => window.clearTimeout(t)), []);

  // The world tint follows the furthest era reached — subtle, not a light show.
  const era = engine.currentEra();
  useEffect(() => {
    document.documentElement.style.setProperty('--era-tint', ERA_TINT[era.id] ?? '16,16,17');
  }, [era.id]);

  // press bursts everywhere; on a desktop the top bar tucks away until the
  // pointer reaches the top edge
  useEffect(() => installPressFx(), []);
  useEffect(() => installImmersiveTop(), []);

  // thirteen bands at most — cheap enough to derive on every render
  const eraTotal = engine.db.eras.length;
  const strata = engine.erasReached().map((e, i) => ({
    id: e.id, y: 100 - (i + 1) * (100 / eraTotal), h: 100 / eraTotal, op: 0.05 + (i / eraTotal) * 0.07,
  }));

  /** Switching view closes any drawer: an exhibit never follows you between views. */
  const showView = useCallback((v: ViewId) => {
    sound.sfx(v === 'graph' ? 'graph' : v === 'arch' || v === 'time' ? 'archive' : 'tab', 0.6);
    setView(v);
    setPanelOpen(false);
    panelReturn.current = null;
  }, [setView]);

  /** Inspect. The exhibit is closed until the player asks for it — pressing
   *  Inspect, the "i" on an inventory item, the I key, the context menu or a
   *  search result. Choosing or dragging a piece never comes through here.
   *  It opens as an overlay drawer (a bottom sheet on a phone) and never
   *  moves what is on the bench. */
  const openExhibit = useCallback((id: string) => {
    sound.sfx('select', 0.5);
    open(id);
    if (!panelOpen && document.activeElement instanceof HTMLElement) panelReturn.current = document.activeElement;
    setPanelOpen(true);
  }, [open, panelOpen]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    const back = panelReturn.current;
    panelReturn.current = null;
    if (back && document.contains(back)) back.focus();
  }, []);

  const openContextMenu = useCallback((x: number, y: number, id: string) => setCtxMenu({ x, y, id }), []);
  const closeContextMenu = useCallback(() => setCtxMenu(null), []);

  /** The context menu's "Find in graph": jump straight there with the node
   *  already focused, regardless of which view the menu was opened from. */
  const findInGraph = useCallback((id: string) => {
    open(id);
    setView('graph');
    setPanelOpen(true);
    panelReturn.current = null;
  }, [open, setView]);

  /** Play the journey through time again, over the running game. */
  const replayJourney = useCallback(() => {
    setPanelOpen(false);
    setShortcutsOpen(false);
    setIntroDone(false);
    setReplay(n => n + 1);
  }, []);

  const confirmReset = useCallback(() => {
    setConfirmOpen(false);
    narrator.reset(Date.now());
    reset();
    tutor.reset(Date.now());
    setPanelOpen(false);
    setOnlyPath(false);
  }, [reset, tutor, narrator]);
  const cancelReset = useCallback(() => setConfirmOpen(false), []);

  const { setHintError } = s;
  const aimHint = useCallback((id: string): string | null => {
    const r = engine.requestHint(id);
    if ('error' in r) return r.error;
    setHintError(null);
    // take the player to the bench, where the hint line lives
    showView('work');
    return null;
  }, [engine, setHintError, showView]);

  // one keyboard listener for the page; it reads the latest state through a ref
  const keys = useRef({ showView, confirmOpen, closePanel, clearSlots, setEnding, shortcutsOpen, result: s.result, place: s.place, replay: replayJourney, entered: s.entered });
  useEffect(() => {
    keys.current = { showView, confirmOpen, closePanel, clearSlots, setEnding, shortcutsOpen, result: s.result, place: s.place, replay: replayJourney, entered: s.entered };
  });
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const k = keys.current;
      if (k.confirmOpen) return;                    // the dialog handles its own keys
      if (k.shortcutsOpen) {                         // the overlay owns the keyboard while it's up
        if (ev.key === 'Escape' || ev.key === '?') { ev.preventDefault(); setShortcutsOpen(false); }
        return;
      }
      if (ev.key === 'Escape') {
        k.closePanel(); k.setEnding(null); k.clearSlots(); setCtxMenu(null);
        return;
      }
      const t = ev.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (ev.key === '/' && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        ev.preventDefault();
        document.getElementById('s-q')?.focus();
        return;
      }
      if (ev.key === '?' && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        ev.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if ((ev.key === 'j' || ev.key === 'J') && k.entered && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !document.querySelector('[aria-modal="true"]:not([hidden])')) {
        ev.preventDefault(); k.replay(); return;
      }
      // W G A T: go to a view — only when nothing modal is up and no key combo is held
      if (!typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !document.querySelector('[aria-modal="true"]:not([hidden])')) {
        const to: Record<string, ViewId> = { w: 'work', g: 'graph', a: 'arch', t: 'time' };
        const v = to[ev.key.toLowerCase()];
        if (v) { ev.preventDefault(); k.showView(v); return; }
      }
      // Enter: accept whatever discovery is currently showing, unless focus
      // is already on something with its own idea of what Enter should do
      if (ev.key === 'Enter' && t && ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(t.tagName)) return;
      if (ev.key === 'Enter' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        const r = k.result;
        if (r && (r.status === 'new' || r.status === 'known')) { ev.preventDefault(); k.place(r.node.id); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resumed = engine.resumed ? engine.stats().core : 0;
  const recent = engine.path().slice(-3).reverse().map(n => n.n);
  const returning = resumed > 4
    ? { era: engine.currentEra().name, latest: recent[0] ?? '', recent, openWork: engine.openWork() } : null;
  /* a returning player is greeted once, quietly, after the world has loaded in */
  const [greeted, setGreeted] = useState(false);
  const showRemember = reveal >= 6 && !!returning && !greeted;
  useEffect(() => {
    if (!showRemember) return;
    const t = window.setTimeout(() => setGreeted(true), 6500);
    return () => window.clearTimeout(t);
  }, [showRemember]);
  const hint = engine.hintView();
  const highlightId = engine.coached === 0 ? 'stone' : hint.highlightId;

  return (
    <MotionConfig reducedMotion="user">
      <div id="ground" aria-hidden="true" />
      <div id="strata" aria-hidden="true">
        <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {strata.map(b => (
            <g key={b.id}>
              <rect x="0" y={`${b.y}%`} width="100%" height={`${b.h}%`}
                fill={`rgb(${ERA_TINT[b.id]})`} opacity={b.op} />
              <line x1="0" y1={`${b.y}%`} x2="100%" y2={`${b.y}%`} style={{ stroke: 'var(--line)' }} strokeWidth="1" />
            </g>
          ))}
        </svg>
      </div>
      <ReactiveField active={s.entered} />
      <EraShift era={era} index={engine.db.eras.findIndex(e => e.id === era.id)} active={s.entered && reveal >= 6} />
      <SceneBackdrop era={era.id} active={s.entered && view === 'work'} discovered={engine.found} />
      <div id="grain" aria-hidden="true" />
      <div id="top-handle" aria-hidden="true"><i /></div>

      <Landing
        db={engine.db}
        gone={introDone}
        resumedCount={resumed > 4 ? resumed : 0}
        returning={returning}
        onBegin={enterFullscreen}
        onEnter={film => {
          s.enter();
          setReveal(1);
          // no film: the same layers, quickly; the film's own timing follows onLanded
          if (!film) stage([[2, 80], [3, 240], [4, 400], [5, 560], [6, 720]]);
        }}
        onLanded={(x, y) => {
          // a brand-new game: the stone that fell is now the first thing on the bench
          if (engine.coached === 0 && engine.order.length <= engine.db.primitives.length) {
            benchSpawn('stone', { clientX: x, clientY: y });
          }
          stage([[2, 450], [3, 1150], [4, 1600], [5, 2050], [6, 2500]]);
        }}
        onDone={() => setIntroDone(true)}
        replay={replay}
        getBenchTarget={() => {
          const el = benchElement();
          const r = el?.getBoundingClientRect();
          if (!el || !r || r.width < 40) return null;
          // the middle of the free scenery, not of the whole screen
          const vars = el.parentElement ?? el;
          const pad = (k: string) => parseFloat(vars.style.getPropertyValue(k)) || 0;
          const l = pad('--wb-pl'), rr = pad('--wb-pr'), t = pad('--wb-pt'), b = pad('--wb-pb');
          return { x: r.left + l + (r.width - l - rr) / 2, y: r.top + t + (r.height - t - b) * 0.52 };
        }}
      />

      <main id="app" className={cn(s.entered && 'on')} data-reveal={reveal}>
        <TopBar
          engine={engine}
          view={view}
          onView={showView}
          onOpen={openExhibit}
          onReset={() => setConfirmOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
          onJournal={() => setJournalOpen(true)}
        />

        <div id="views" data-current={view}>
          <section className={'view' + (view === 'work' ? ' on' : '')} id="v-work" role="tabpanel" aria-label="Workspace">
            <Bench
              engine={engine}
              active={s.entered && view === 'work'}
              result={s.result}
              hint={hint}
              hintError={s.hintError}
              onCombine={s.combineOnBench}
              onProcess={s.processOnBench}
              onBegin={s.dismissResult}
              onOpen={openExhibit}
              onUse={id => s.place(id)}
              onRequestHint={() => { s.requestHint(); }}
              onDropHint={() => { engine.dropHint(); s.setHintError(null); }}
            />
            <InventoryRail
              engine={engine}
              slotA={s.slotA}
              slotB={s.slotB}
              highlightId={highlightId}
              onPick={s.place}
              onDrop={s.drop}
              onBenchDrop={s.dropOnBench}
              onContextMenu={openContextMenu}
              onInspect={openExhibit}
            />
          </section>

          <GraphView
            engine={engine}
            version={version}
            active={view === 'graph'}
            onlyPath={onlyPath}
            onOnlyPathChange={setOnlyPath}
            fitSignal={fitSignal}
            focusId={s.focus?.id ?? null}
            onOpen={openExhibit}
          />
          <ArchiveView engine={engine} version={version} active={view === 'arch'} onOpen={openExhibit} />
          <TimelineView engine={engine} version={version} active={view === 'time'} focusId={s.focus?.id ?? null} onOpen={openExhibit} />

          {/* outside the three views: a column beside the bench, a drawer over the
              graph and the archive, a bottom sheet on a phone */}
          <ExhibitPanel
            engine={engine}
            node={s.focus}
            open={panelOpen}
            onOpen={openExhibit}
            onClose={closePanel}
            onHint={aimHint}
          />
        </div>
        <ViewVeil view={view} />
      </main>

      {showRemember && returning && (
        <p className="remember mono" role="status">
          The world remembers.
          <span>{returning.era} · {resumed} discoveries{returning.latest ? ` · last, ${returning.latest}` : ''}</span>
          {returning.openWork > 0 && (
            <span>
              {returning.openWork} {returning.openWork === 1 ? 'thing' : 'things'} you hold could still react to what you know
            </span>
          )}
        </p>
      )}

      <nav id="mtabs" aria-label="Views">
        {([
          ['work', 'Workspace'], ['graph', 'Graph'], ['arch', 'Archive'], ['time', 'Timeline'],
        ] as [ViewId, string][]).map(([id, label]) => (
          <button key={id} aria-pressed={view === id} onClick={() => showView(id)}>
            <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.4" fill="none" aria-hidden="true">
              {id === 'work' && <><rect x="2" y="6" width="7" height="8" /><rect x="11" y="6" width="7" height="8" /></>}
              {id === 'graph' && <><circle cx="4" cy="10" r="2" /><circle cx="16" cy="5" r="2" /><circle cx="16" cy="15" r="2" /><path d="M6 9l8-3M6 11l8 3" /></>}
              {id === 'time' && <><path d="M2 10h16" /><circle cx="5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15" cy="10" r="1.6" /><path d="M5 4v4M10 12v4M15 4v4" /></>}
              {id === 'arch' && <><rect x="3" y="3" width="6" height="6" /><rect x="11" y="3" width="6" height="6" /><rect x="3" y="11" width="6" height="6" /><rect x="11" y="11" width="6" height="6" /></>}
            </svg>
            <ReactiveLabel text={label} className="mono" />
          </button>
        ))}
      </nav>

      {s.ending && (
        <Ending
          engine={engine}
          node={s.ending}
          onClose={() => setEnding(null)}
          onSeePath={() => {
            setEnding(null);
            showView('graph');
            setOnlyPath(true);
            setFitSignal(n => n + 1);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Start over"
        body="Start again from four raw materials? Your discoveries, routes and hints will be cleared."
        cancelLabel="Keep playing"
        confirmLabel="Clear my path"
        onCancel={cancelReset}
        onConfirm={confirmReset}
      />

      <JournalPanel open={journalOpen} engine={engine} onClose={() => setJournalOpen(false)} />

      <ContextMenu
        target={ctxMenu}
        engine={engine}
        onOpen={openExhibit}
        onFindInGraph={findInGraph}
        onPlace={s.place}
        onClose={closeContextMenu}
      />

      <NarratorView
        narrator={narrator}
        engine={engine}
        entered={s.entered && reveal >= 6}
        active={s.entered && reveal >= 6 && view === 'work' && !s.ending && !confirmOpen}
        result={s.result}
      />

      {s.entered && reveal >= 6 && (
        <QuestionCard
          tutor={tutor}
          engine={engine}
          busy={panelOpen || !!s.ending || confirmOpen || shortcutsOpen || journalOpen || view !== 'work'}
        />
      )}

      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} onReplay={replayJourney} />

      <div id="toasts" aria-live="polite">
        {s.toasts.map(t => (
          <div key={t.key} className={cn('toast', `t-${t.kind}`)}>
            {t.node && <Glyph node={t.node} />}
            <div>
              <div className="tt">{t.title}</div>
              <div className="ts mono">{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </MotionConfig>
  );
}
