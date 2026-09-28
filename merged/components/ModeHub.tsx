'use client';

import { useState, useSyncExternalStore } from 'react';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { TechSudokuModal } from './techsudoku/TechSudokuModal';
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
   entry is `status: 'available'` — today that's Main Evolution and Survival.
   Every other mode stays out of this screen entirely until it is real; see
   lib/modes/registry.ts's own comment on why that list must never become a
   grid of locked "coming soon" placeholders.
   ========================================================================== */

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function ModeHub({ engine, active, onLaunch, onLaunchMode }: {
  engine: Engine;
  active: boolean;
  /** Launches Main Evolution itself (switches Sandbox's own view). */
  onLaunch: () => void;
  /** Launches any other available mode — provided by components/AppRoot.tsx. */
  onLaunchMode?: (mode: ModeId) => void;
}) {
  // re-render when the shared profile changes (e.g. a visit recorded elsewhere this session)
  const profileVersion = useSyncExternalStore(profile.subscribe, profile.getVersion, () => 0);
  void profileVersion;
  const survivalVersion = useSyncExternalStore(survivalStore.subscribe, survivalStore.getVersion, () => 0);
  void survivalVersion;
  const [sudokuOpen, setSudokuOpen] = useState(false);
  const p = profile.get();
  const stats = engine.stats();
  const era = engine.currentEra();
  const mainEvo = getMode('main-evolution');
  const survivalMode = getMode('survival');
  const visit = p.modes['main-evolution'];
  const survivalVisit = p.modes['survival'];
  const survival = survivalStore.get();

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

        <div className="hub-exhibit">
          <div className="hub-exhibit-plate" aria-hidden="true" />
          <div className="hub-exhibit-body">
            <p className="mono hub-exhibit-kicker">{mainEvo?.subtitle ?? 'The Timeline'}</p>
            <h2 className="hub-exhibit-title">{mainEvo?.title ?? 'Main Evolution'}</h2>
            <p className="hub-exhibit-desc">{mainEvo?.description}</p>
            <dl className="hub-exhibit-stats">
              <div><dt className="mono">Discovered</dt><dd>{stats.core} / {stats.coreTotal}</dd></div>
              <div><dt className="mono">Era reached</dt><dd>{era.name}</dd></div>
              <div>
                <dt className="mono">First entered</dt>
                <dd>{visit ? dateFmt.format(visit.firstVisitedAt) : 'Not yet'}</dd>
              </div>
            </dl>
            <button className="hub-continue" onClick={onLaunch}>
              <ReactiveLabel text={visit ? 'Continue' : 'Enter'} className="mono" />
            </button>
          </div>
        </div>

        <div className="hub-exhibit">
          <div className="hub-exhibit-plate" aria-hidden="true" />
          <div className="hub-exhibit-body">
            <p className="mono hub-exhibit-kicker">{survivalMode?.subtitle ?? 'Adapt'}</p>
            <h2 className="hub-exhibit-title">{survivalMode?.title ?? 'Survival'}</h2>
            <p className="hub-exhibit-desc">{survivalMode?.description}</p>
            <dl className="hub-exhibit-stats">
              <div><dt className="mono">Runs completed</dt><dd>{survival.memories.length}</dd></div>
              <div>
                <dt className="mono">Active run</dt>
                <dd>{survival.active ? `Day ${survival.active.day}` : 'None'}</dd>
              </div>
              <div>
                <dt className="mono">First entered</dt>
                <dd>{survivalVisit ? dateFmt.format(survivalVisit.firstVisitedAt) : 'Not yet'}</dd>
              </div>
            </dl>
            <button className="hub-continue" onClick={() => onLaunchMode?.('survival')}>
              <ReactiveLabel text={survival.active ? 'Continue' : 'Enter'} className="mono" />
            </button>
          </div>
        </div>

        <p className="hub-note">
          Other wings of this museum — Archaeology, Civilization, Decipher and more — are in active
          development. They will open here, alongside Main Evolution and Survival, as each is finished.
        </p>

        <p className="hub-extra-link">
          <button type="button" onClick={() => setSudokuOpen(true)}>Today&rsquo;s Tech Sudoku — a five-minute puzzle</button>
        </p>
      </div>

      <TechSudokuModal open={sudokuOpen} engine={engine} onClose={() => setSudokuOpen(false)} />
    </section>
  );
}
