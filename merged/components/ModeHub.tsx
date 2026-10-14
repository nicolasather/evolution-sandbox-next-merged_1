'use client';

import { Children, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { TechSudokuModal } from './techsudoku/TechSudokuModal';
import { WeeklyChallengeModal } from './weekly/WeeklyChallengeModal';
import { archaeologyStore } from '@/lib/archaeology/store';
import { hubSummaryServerSnapshot, hubSummarySnapshot, subscribeHubSummary, type HubSummary } from '@/lib/civilization/lifelines/hubSummary';
import { alienArchaeologyStore } from '@/lib/alienarchaeology/store';
import { decipherStore } from '@/lib/decipher/store';
import { escapeRoomStore } from '@/lib/escaperoom/store';
import { profile } from '@/lib/profile/store';
import { reverseEvolutionStore } from '@/lib/reverseevolution/store';
import { noteFrom, verifiedPacket, packetsFeatureOn } from '@/lib/modes/packets';
import { getMode } from '@/lib/modes/registry';
import { survivalStore } from '@/lib/survival/store';
import type { Engine } from '@/lib/engine';
import type { ModeId } from '@/lib/modes/types';
import { featureOfMode, type FeatureId } from '@/lib/unlocks/registry';
import { NO_LOCKS, type Unlocks } from '@/lib/unlocks/useUnlocks';

/* ============================================================================
   MODE HUB — the switcher between Main Evolution and every other experience
   Evolution Sandbox will eventually contain. Reachable from the top bar
   after the intro, without disturbing it (see TopBar's Hub button and
   Sandbox.tsx's 'hub' ViewId).

   Only ever renders a launchable card for a mode whose lib/modes/registry.ts
   entry is `status: 'available'` — today that's Main Evolution, Survival
   and Civilization. Every other mode stays out of this screen entirely
   until it is real; see lib/modes/registry.ts's own comment on why that
   list must never become a grid of locked "coming soon" placeholders.
   ========================================================================== */

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function ExhibitCard({ kicker, title, description, stats, ctaLabel, onLaunch, fresh, modeId }: {
  kicker: string;
  title: string;
  description: string;
  stats: { label: string; value: ReactNode }[];
  ctaLabel: string;
  onLaunch: () => void;
  /** Just unlocked and never entered: the Enter button glows and the card says NEW. */
  fresh?: boolean;
  /** Phase 2 (off by default): reviewed, certified flavour for this mode, shown under the description. */
  modeId?: ModeId;
}) {
  const [note, setNote] = useState<{ text: string; disclosure: string | null } | null>(null);
  useEffect(() => {
    if (!modeId || !packetsFeatureOn()) return;
    let live = true;
    verifiedPacket(modeId).then(e => { if (live) setNote(noteFrom(e)); });
    return () => { live = false; };
  }, [modeId]);
  return (
    <div className={'hub-exhibit' + (fresh ? ' is-new' : '')} data-new={fresh || undefined}>
      <div className="hub-exhibit-plate" aria-hidden="true" />
      <div className="hub-exhibit-body">
        <p className="mono hub-exhibit-kicker">{kicker}{fresh && <b className="hub-new"> · New</b>}</p>
        <h2 className="hub-exhibit-title">{title}</h2>
        <p className="hub-exhibit-desc">{description}</p>
        {note && <p className="hub-exhibit-desc mono" data-testid="packet-note" style={{ opacity: 0.8, fontSize: 12 }}>{note.text}{note.disclosure ? ` — ${note.disclosure}` : ''}</p>}
        <dl className="hub-exhibit-stats">
          {stats.map(s => <div key={s.label}><dt className="mono">{s.label}</dt><dd>{s.value}</dd></div>)}
        </dl>
        <button className={'hub-continue' + (fresh ? ' guide-glow' : '')} onClick={onLaunch}>
          <ReactiveLabel text={ctaLabel} className="mono" />
        </button>
      </div>
    </div>
  );
}

/** Every wing as one slide of a horizontal track, with a bar to slide along it
 *  (drag the bar, press the arrows, swipe, or use ← → on the track). */
function ModeTrack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const n = items.length;
  const [pos, setPos] = useState(0);   // 0…1000
  const [at, setAt] = useState(0);     // current card index

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const f = max > 0 ? el.scrollLeft / max : 0;
    setPos(Math.round(f * 1000));
    setAt(Math.round(f * (n - 1)));
  }, [n]);

  useEffect(() => { sync(); }, [sync]);

  const scrubTo = (v: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.scrollBehavior = 'auto';
    el.scrollLeft = (v / 1000) * (el.scrollWidth - el.clientWidth);
    el.style.scrollBehavior = '';
  };
  const go = (i: number) => {
    const el = ref.current;
    const card = el?.children[Math.max(0, Math.min(n - 1, i))] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <>
      <div className="hub-track" ref={ref} onScroll={sync} tabIndex={0} aria-label="Modes, scroll sideways"
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
        }}>
        {items}
      </div>
      <p className="hub-count" aria-live="polite">{at + 1} / {n}</p>
      <div className="hub-bar">
        <button type="button" aria-label="Previous mode" disabled={at <= 0} onClick={() => go(at - 1)}>‹</button>
        <input className="hub-range" type="range" min={0} max={1000} step={1} value={pos} aria-label="Slide between modes"
          onChange={e => scrubTo(Number(e.target.value))} />
        <button type="button" aria-label="Next mode" disabled={at >= n - 1} onClick={() => go(at + 1)}>›</button>
      </div>
    </>
  );
}

export function ModeHub({ engine, active, onLaunch, onLaunchMode, unlocks = NO_LOCKS }: {
  engine: Engine;
  active: boolean;
  /** What has opened so far. Left out, every wing is open. */
  unlocks?: Pick<Unlocks, 'has' | 'fresh' | 'opened'>;
  /** Launches Main Evolution itself (switches Sandbox's own view). */
  onLaunch: () => void;
  /** Launches any other available mode — provided by components/AppRoot.tsx. */
  onLaunchMode?: (mode: ModeId) => void;
}) {
  // re-render when any store this screen reads from changes
  const profileVersion = useSyncExternalStore(profile.subscribe, profile.getVersion, () => 0);
  void profileVersion;
  const survivalVersion = useSyncExternalStore(survivalStore.subscribe, survivalStore.getVersion, () => 0);
  void survivalVersion;
  // Civilization (Lifelines + the earlier saves): a content-free summary, safe to read on the hub.
  const civ: HubSummary = JSON.parse(useSyncExternalStore(subscribeHubSummary, hubSummarySnapshot, hubSummaryServerSnapshot));
  const archVersion = useSyncExternalStore(archaeologyStore.subscribe, archaeologyStore.getVersion, () => 0);
  void archVersion;
  const decVersion = useSyncExternalStore(decipherStore.subscribe, decipherStore.getVersion, () => 0);
  void decVersion;
  const escVersion = useSyncExternalStore(escapeRoomStore.subscribe, escapeRoomStore.getVersion, () => 0);
  void escVersion;
  const alienVersion = useSyncExternalStore(alienArchaeologyStore.subscribe, alienArchaeologyStore.getVersion, () => 0);
  void alienVersion;
  const revVersion = useSyncExternalStore(reverseEvolutionStore.subscribe, reverseEvolutionStore.getVersion, () => 0);
  void revVersion;
  const [sudokuOpen, setSudokuOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const p = profile.get();
  const stats = engine.stats();
  const era = engine.currentEra();
  const mainEvo = getMode('main-evolution');
  const survivalMode = getMode('survival');
  const civMode = getMode('civilization');
  const archMode = getMode('archaeology');
  const decMode = getMode('decipher');
  const escMode = getMode('escape-room');
  const alienMode = getMode('alien-archaeology');
  const revMode = getMode('reverse-evolution');
  const visit = p.modes['main-evolution'];
  const survivalVisit = p.modes['survival'];
  const civVisit = p.modes['civilization'];
  const archVisit = p.modes['archaeology'];
  const decVisit = p.modes['decipher'];
  const escVisit = p.modes['escape-room'];
  const alienVisit = p.modes['alien-archaeology'];
  const revVisit = p.modes['reverse-evolution'];
  const survival = survivalStore.get();
  const archaeology = archaeologyStore.get();
  const decipher = decipherStore.get();
  const escapeRoom = escapeRoomStore.get();
  const alien = alienArchaeologyStore.get();
  const reverseEvo = reverseEvolutionStore.get();

  /** A wing's card exists only once it is unlocked; entering it ends its glow for good. */
  const open = (m: ModeId) => () => {
    const f = featureOfMode(m);
    if (f) unlocks.opened(f);
    onLaunchMode?.(m);
  };
  const shown = (m: ModeId) => { const f = featureOfMode(m); return !f || unlocks.has(f); };
  const isNew = (m: ModeId) => { const f = featureOfMode(m); return !!f && unlocks.fresh(f as FeatureId); };

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-hub" role="tabpanel" aria-label="Mode Hub">
      <div className="hub-wrap">
        <header className="hub-head">
          <p className="mono hub-eyebrow">Evolution Sandbox</p>
          <h1 className="hub-title">The Hub</h1>
          <p className="hub-sub">
            One coherent universe of discoveries, artifacts and history — entered here, one wing at a time.
          </p>
        </header>

        <ModeTrack>
        <ExhibitCard
          kicker={mainEvo?.subtitle ?? 'The Timeline'}
          title={mainEvo?.title ?? 'Main Evolution'}
          description={mainEvo?.description ?? ''}
          ctaLabel={visit ? 'Continue' : 'Enter'}
          onLaunch={onLaunch}
          stats={[
            { label: 'Discovered', value: `${stats.core} / ${stats.coreTotal}` },
            { label: 'Era reached', value: era.name },
            { label: 'First entered', value: visit ? dateFmt.format(visit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        {shown('survival') && (
        <ExhibitCard
          kicker={survivalMode?.subtitle ?? 'Adapt'}
          title={survivalMode?.title ?? 'Survival'}
          description={survivalMode?.description ?? ''}
          ctaLabel={survival.active ? 'Continue' : 'Enter'}
          onLaunch={open('survival')}
          modeId="survival"
          fresh={isNew('survival')}
          stats={[
            { label: 'Runs completed', value: survival.memories.length },
            { label: 'Active run', value: survival.active ? `Day ${survival.active.day}` : 'None' },
            { label: 'First entered', value: survivalVisit ? dateFmt.format(survivalVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}

        {shown('civilization') && (
        <ExhibitCard
          kicker={civMode?.subtitle ?? 'Build'}
          title={civMode?.title ?? 'Civilization'}
          description={civMode?.description ?? ''}
          ctaLabel={civ.kind !== 'none' ? 'Continue' : 'Enter'}
          onLaunch={open('civilization')}
          modeId="civilization"
          fresh={isNew('civilization')}
          stats={[
            { label: 'Chapters completed', value: `${civ.completed} / 24` },
            { label: 'Current settlement', value: civ.kind === 'none' ? 'None' : civ.line },
            { label: 'First entered', value: civVisit ? dateFmt.format(civVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}

        {shown('archaeology') && (
        <ExhibitCard
          kicker={archMode?.subtitle ?? 'Recover'}
          title={archMode?.title ?? 'Archaeologist'}
          description={archMode?.description ?? ''}
          ctaLabel={archaeology.active ? 'Continue' : 'Enter'}
          onLaunch={open('archaeology')}
          modeId="archaeology"
          fresh={isNew('archaeology')}
          stats={[
            { label: 'Reports filed', value: archaeology.reports.length },
            { label: 'Active dig', value: archaeology.active ? 'In progress' : 'None' },
            { label: 'First entered', value: archVisit ? dateFmt.format(archVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}

        {shown('decipher') && (
        <ExhibitCard
          kicker={decMode?.subtitle ?? 'Read the Lost'}
          title={decMode?.title ?? 'Decipher'}
          description={decMode?.description ?? ''}
          ctaLabel={decipher.activePuzzle ? 'Continue' : decipher.tutorialCompleted ? 'Enter' : 'Start the tutorial'}
          onLaunch={open('decipher')}
          modeId="decipher"
          fresh={isNew('decipher')}
          stats={[
            { label: 'Tablets read', value: decipher.memories.length },
            { label: 'Tutorial', value: decipher.tutorialCompleted ? 'Completed' : 'Not yet' },
            { label: 'First entered', value: decVisit ? dateFmt.format(decVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}

        {shown('escape-room') && (
        <ExhibitCard
          kicker={escMode?.subtitle ?? 'Enter the Past'}
          title={escMode?.title ?? 'Historical Escape Room'}
          description={escMode?.description ?? ''}
          ctaLabel={escapeRoom.activeState ? 'Continue' : 'Enter'}
          onLaunch={open('escape-room')}
          modeId="escape-room"
          fresh={isNew('escape-room')}
          stats={[
            { label: 'Episodes completed', value: escapeRoom.memories.length },
            { label: 'In progress', value: escapeRoom.activeState ? `${escapeRoom.activeState.solvedPuzzleIds.length} stations solved` : 'None' },
            { label: 'First entered', value: escVisit ? dateFmt.format(escVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}

        {shown('alien-archaeology') && (
        <ExhibitCard
          kicker={alienMode?.subtitle ?? 'Unknown Worlds'}
          title={alienMode?.title ?? 'Alien Archaeology'}
          description={alienMode?.description ?? ''}
          ctaLabel={alien.active ? 'Continue' : 'Enter'}
          onLaunch={open('alien-archaeology')}
          modeId="alien-archaeology"
          fresh={isNew('alien-archaeology')}
          stats={[
            { label: 'Field reports filed', value: alien.reports.length },
            { label: 'Active site', value: alien.active ? 'In progress' : 'None' },
            { label: 'First entered', value: alienVisit ? dateFmt.format(alienVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}

        {shown('reverse-evolution') && (
        <ExhibitCard
          kicker={revMode?.subtitle ?? 'From Smartphone to Stone'}
          title={revMode?.title ?? 'Reverse Evolution'}
          description={revMode?.description ?? ''}
          ctaLabel={reverseEvo.active ? 'Continue' : 'Enter'}
          onLaunch={open('reverse-evolution')}
          modeId="reverse-evolution"
          fresh={isNew('reverse-evolution')}
          stats={[
            { label: 'Discoveries traced', value: reverseEvo.runs.length },
            { label: 'Active trace', value: reverseEvo.active ? 'In progress' : 'None' },
            { label: 'First entered', value: revVisit ? dateFmt.format(revVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />
        )}
        {getMode('minimum-path')?.status === 'available' && shown('minimum-path') && <ExhibitCard
          kicker="Atlas"
          title={getMode('minimum-path')?.title ?? 'Minimum Path'}
          description="Find the shortest route through the game's recipe network, with checkpoints and blocked paths."
          ctaLabel="Enter"
          onLaunch={open('minimum-path')}
          modeId="minimum-path"
          fresh={isNew('minimum-path')}
          stats={[]}
        />}
        </ModeTrack>

        <p className="hub-note">
          More wings open here as you move through history.
          Other wings of this museum are in active development; they will join these as each is finished.
        </p>

        {unlocks.has('puzzles') && (
          <>
            <p className="hub-extra-link">
              <button type="button" className={unlocks.fresh('puzzles') ? 'guide-glow' : undefined}
                onClick={() => { unlocks.opened('puzzles'); setSudokuOpen(true); }}>Today&rsquo;s Tech Sudoku — a five-minute puzzle</button>
            </p>
            <p className="hub-extra-link">
              <button type="button" className={unlocks.fresh('puzzles') ? 'guide-glow' : undefined}
                onClick={() => { unlocks.opened('puzzles'); setWeeklyOpen(true); }}>This week&rsquo;s Mega Challenge — three stages</button>
            </p>
          </>
        )}
      </div>

      <TechSudokuModal open={sudokuOpen} engine={engine} onClose={() => setSudokuOpen(false)} />
      <WeeklyChallengeModal open={weeklyOpen} engine={engine} onClose={() => setWeeklyOpen(false)} />
    </section>
  );
}
