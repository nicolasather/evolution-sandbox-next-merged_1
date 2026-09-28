'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { TechSudokuModal } from './techsudoku/TechSudokuModal';
import { archaeologyStore } from '@/lib/archaeology/store';
import { civilizationStore } from '@/lib/civilization/store';
import { alienArchaeologyStore } from '@/lib/alienarchaeology/store';
import { decipherStore } from '@/lib/decipher/store';
import { escapeRoomStore } from '@/lib/escaperoom/store';
import { profile } from '@/lib/profile/store';
import { getMode } from '@/lib/modes/registry';
import { survivalStore } from '@/lib/survival/store';
import type { Engine } from '@/lib/engine';
import type { ModeId } from '@/lib/modes/types';

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

function ExhibitCard({ kicker, title, description, stats, ctaLabel, onLaunch }: {
  kicker: string;
  title: string;
  description: string;
  stats: { label: string; value: ReactNode }[];
  ctaLabel: string;
  onLaunch: () => void;
}) {
  return (
    <div className="hub-exhibit">
      <div className="hub-exhibit-plate" aria-hidden="true" />
      <div className="hub-exhibit-body">
        <p className="mono hub-exhibit-kicker">{kicker}</p>
        <h2 className="hub-exhibit-title">{title}</h2>
        <p className="hub-exhibit-desc">{description}</p>
        <dl className="hub-exhibit-stats">
          {stats.map(s => <div key={s.label}><dt className="mono">{s.label}</dt><dd>{s.value}</dd></div>)}
        </dl>
        <button className="hub-continue" onClick={onLaunch}>
          <ReactiveLabel text={ctaLabel} className="mono" />
        </button>
      </div>
    </div>
  );
}

export function ModeHub({ engine, active, onLaunch, onLaunchMode }: {
  engine: Engine;
  active: boolean;
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
  const civVersion = useSyncExternalStore(civilizationStore.subscribe, civilizationStore.getVersion, () => 0);
  void civVersion;
  const archVersion = useSyncExternalStore(archaeologyStore.subscribe, archaeologyStore.getVersion, () => 0);
  void archVersion;
  const decVersion = useSyncExternalStore(decipherStore.subscribe, decipherStore.getVersion, () => 0);
  void decVersion;
  const escVersion = useSyncExternalStore(escapeRoomStore.subscribe, escapeRoomStore.getVersion, () => 0);
  void escVersion;
  const alienVersion = useSyncExternalStore(alienArchaeologyStore.subscribe, alienArchaeologyStore.getVersion, () => 0);
  void alienVersion;
  const [sudokuOpen, setSudokuOpen] = useState(false);

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
  const visit = p.modes['main-evolution'];
  const survivalVisit = p.modes['survival'];
  const civVisit = p.modes['civilization'];
  const archVisit = p.modes['archaeology'];
  const decVisit = p.modes['decipher'];
  const escVisit = p.modes['escape-room'];
  const alienVisit = p.modes['alien-archaeology'];
  const survival = survivalStore.get();
  const civilization = civilizationStore.get();
  const archaeology = archaeologyStore.get();
  const decipher = decipherStore.get();
  const escapeRoom = escapeRoomStore.get();
  const alien = alienArchaeologyStore.get();

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

        <ExhibitCard
          kicker={survivalMode?.subtitle ?? 'Adapt'}
          title={survivalMode?.title ?? 'Survival'}
          description={survivalMode?.description ?? ''}
          ctaLabel={survival.active ? 'Continue' : 'Enter'}
          onLaunch={() => onLaunchMode?.('survival')}
          stats={[
            { label: 'Runs completed', value: survival.memories.length },
            { label: 'Active run', value: survival.active ? `Day ${survival.active.day}` : 'None' },
            { label: 'First entered', value: survivalVisit ? dateFmt.format(survivalVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        <ExhibitCard
          kicker={civMode?.subtitle ?? 'Build'}
          title={civMode?.title ?? 'Civilization'}
          description={civMode?.description ?? ''}
          ctaLabel={civilization.active ? 'Continue' : 'Enter'}
          onLaunch={() => onLaunchMode?.('civilization')}
          stats={[
            { label: 'Settlements founded', value: civilization.dioramas.length },
            { label: 'Active settlement', value: civilization.active ? `Year ${civilization.active.year}` : 'None' },
            { label: 'First entered', value: civVisit ? dateFmt.format(civVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        <ExhibitCard
          kicker={archMode?.subtitle ?? 'Recover'}
          title={archMode?.title ?? 'Archaeologist'}
          description={archMode?.description ?? ''}
          ctaLabel={archaeology.active ? 'Continue' : 'Enter'}
          onLaunch={() => onLaunchMode?.('archaeology')}
          stats={[
            { label: 'Reports filed', value: archaeology.reports.length },
            { label: 'Active dig', value: archaeology.active ? 'In progress' : 'None' },
            { label: 'First entered', value: archVisit ? dateFmt.format(archVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        <ExhibitCard
          kicker={decMode?.subtitle ?? 'Read the Lost'}
          title={decMode?.title ?? 'Decipher'}
          description={decMode?.description ?? ''}
          ctaLabel={decipher.activePuzzle ? 'Continue' : decipher.tutorialCompleted ? 'Enter' : 'Start the tutorial'}
          onLaunch={() => onLaunchMode?.('decipher')}
          stats={[
            { label: 'Tablets read', value: decipher.memories.length },
            { label: 'Tutorial', value: decipher.tutorialCompleted ? 'Completed' : 'Not yet' },
            { label: 'First entered', value: decVisit ? dateFmt.format(decVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        <ExhibitCard
          kicker={escMode?.subtitle ?? 'Enter the Past'}
          title={escMode?.title ?? 'Historical Escape Room'}
          description={escMode?.description ?? ''}
          ctaLabel={escapeRoom.activeState ? 'Continue' : 'Enter'}
          onLaunch={() => onLaunchMode?.('escape-room')}
          stats={[
            { label: 'Episodes completed', value: escapeRoom.memories.length },
            { label: 'In progress', value: escapeRoom.activeState ? `${escapeRoom.activeState.solvedPuzzleIds.length} stations solved` : 'None' },
            { label: 'First entered', value: escVisit ? dateFmt.format(escVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        <ExhibitCard
          kicker={alienMode?.subtitle ?? 'Unknown Worlds'}
          title={alienMode?.title ?? 'Alien Archaeology'}
          description={alienMode?.description ?? ''}
          ctaLabel={alien.active ? 'Continue' : 'Enter'}
          onLaunch={() => onLaunchMode?.('alien-archaeology')}
          stats={[
            { label: 'Field reports filed', value: alien.reports.length },
            { label: 'Active site', value: alien.active ? 'In progress' : 'None' },
            { label: 'First entered', value: alienVisit ? dateFmt.format(alienVisit.firstVisitedAt) : 'Not yet' },
          ]}
        />

        <p className="hub-note">
          Other wings of this museum are in active development. They will open here, alongside
          these, as each is finished.
        </p>

        <p className="hub-extra-link">
          <button type="button" onClick={() => setSudokuOpen(true)}>Today&rsquo;s Tech Sudoku — a five-minute puzzle</button>
        </p>
      </div>

      <TechSudokuModal open={sudokuOpen} engine={engine} onClose={() => setSudokuOpen(false)} />
    </section>
  );
}
