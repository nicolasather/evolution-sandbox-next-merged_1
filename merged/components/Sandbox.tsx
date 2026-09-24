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
import { SceneBackdrop } from './SceneBackdrop';
import { ReactiveField } from './fx/ReactiveField';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { ViewVeil } from './fx/ViewVeil';
import { ContextMenu, type ContextMenuTarget } from './fx/ContextMenu';
import { ShortcutsOverlay } from './fx/ShortcutsOverlay';
import { enterFullscreen, installImmersiveTop, installPressFx } from '@/lib/fx';
import { ERA_TINT, useSandbox } from '@/lib/useSandbox';
import { cn } from '@/lib/utils';
import type { ViewId } from '@/lib/types';

const GraphView = dynamic(() => import('./GraphView').then(mod => mod.GraphView), { ssr: false });
const ArchiveView = dynamic(() => import('./ArchiveView').then(mod => mod.ArchiveView), { ssr: false });

const PHONE = '(max-width:900px)';
const isPhone = () => window.matchMedia(PHONE).matches;

export function Sandbox() {
  const [panelOpen, setPanelOpen] = useState(false);
  const s = useSandbox();
  const { engine, version, view, setView, open, clearSlots, setEnding, reset } = s;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [onlyPath, setOnlyPath] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuTarget | null>(null);
  const panelReturn = useRef<HTMLElement | null>(null);

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
    setView(v);
    setPanelOpen(false);
    panelReturn.current = null;
  }, [setView]);

  /** Beside the bench the exhibit is a column that is always there. Over the
   *  graph or the archive — and on a phone — it opens as a drawer, and only
   *  when the player asks for it: a discovery never throws a sheet over the bench. */
  const openExhibit = useCallback((id: string) => {
    open(id);
    if (isPhone() || view !== 'work') {
      if (!panelOpen && document.activeElement instanceof HTMLElement) panelReturn.current = document.activeElement;
      setPanelOpen(true);
    }
  }, [open, view, panelOpen]);

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

  const confirmReset = useCallback(() => {
    setConfirmOpen(false);
    reset();
    setPanelOpen(false);
    setOnlyPath(false);
  }, [reset]);
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
  const keys = useRef({ confirmOpen, closePanel, clearSlots, setEnding, shortcutsOpen, result: s.result, place: s.place });
  useEffect(() => {
    keys.current = { confirmOpen, closePanel, clearSlots, setEnding, shortcutsOpen, result: s.result, place: s.place };
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
      <SceneBackdrop era={era.id} active={s.entered && view === 'work'} />
      <div id="grain" aria-hidden="true" />
      <div id="top-handle" aria-hidden="true"><i /></div>

      <Landing db={engine.db} gone={s.entered} resumedCount={resumed > 4 ? resumed : 0} onBegin={() => { enterFullscreen(); s.enter(); }} />

      <main id="app" className={cn(s.entered && 'on')}>
        <TopBar
          engine={engine}
          view={view}
          onView={showView}
          onOpen={openExhibit}
          onReset={() => setConfirmOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
        />

        <div id="views" data-current={view}>
          <section className={'view' + (view === 'work' ? ' on' : '')} id="v-work" role="tabpanel" aria-label="Workspace">
            <Bench
              engine={engine}
              slotA={s.slotA}
              slotB={s.slotB}
              result={s.result}
              busy={s.busy}
              hint={hint}
              hintError={s.hintError}
              onClear={s.clearSlot}
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
              onContextMenu={openContextMenu}
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

      <nav id="mtabs" aria-label="Views">
        {([
          ['work', 'Workspace'], ['graph', 'Graph'], ['arch', 'Archive'],
        ] as [ViewId, string][]).map(([id, label]) => (
          <button key={id} aria-pressed={view === id} onClick={() => showView(id)}>
            <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.4" fill="none" aria-hidden="true">
              {id === 'work' && <><rect x="2" y="6" width="7" height="8" /><rect x="11" y="6" width="7" height="8" /></>}
              {id === 'graph' && <><circle cx="4" cy="10" r="2" /><circle cx="16" cy="5" r="2" /><circle cx="16" cy="15" r="2" /><path d="M6 9l8-3M6 11l8 3" /></>}
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

      <ContextMenu
        target={ctxMenu}
        engine={engine}
        onOpen={openExhibit}
        onFindInGraph={findInGraph}
        onPlace={s.place}
        onClose={closeContextMenu}
      />

      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

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
