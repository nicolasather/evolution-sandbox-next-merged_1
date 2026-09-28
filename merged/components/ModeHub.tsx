'use client';

import { useSyncExternalStore } from 'react';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { profile } from '@/lib/profile/store';
import { getMode } from '@/lib/modes/registry';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   MODE HUB — the switcher between Main Evolution and every other experience
   Evolution Sandbox will eventually contain. Reachable from the top bar
   after the intro, without disturbing it (see TopBar's Hub button and
   Sandbox.tsx's 'hub' ViewId).

   This is architecture landing ahead of content: only Main Evolution is a
   real, playable mode today, so this screen shows exactly one launchable
   exhibit — Main Evolution itself, with its actual resume state — never a
   grid of locked or "coming soon" cards for the modes that don't exist yet.
   lib/modes/registry.ts already lists the full planned roster so nothing
   here needs renaming when they arrive.
   ========================================================================== */

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function ModeHub({ engine, active, onLaunch }: {
  engine: Engine;
  active: boolean;
  onLaunch: () => void;
}) {
  // re-render when the shared profile changes (e.g. a visit recorded elsewhere this session)
  const profileVersion = useSyncExternalStore(profile.subscribe, profile.getVersion, () => 0);
  void profileVersion;
  const p = profile.get();
  const stats = engine.stats();
  const era = engine.currentEra();
  const mainEvo = getMode('main-evolution');
  const visit = p.modes['main-evolution'];

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

        <p className="hub-note">
          Other wings of this museum — Archaeology, Survival, Civilization, Decipher and more — are in
          active development. They will open here, alongside Main Evolution, as each is finished.
        </p>
      </div>
    </section>
  );
}
