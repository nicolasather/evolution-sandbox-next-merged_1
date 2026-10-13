'use client';

import { useEffect, useState } from 'react';
import { generateCamp } from '@/lib/survival/generate';
import { memoryExhibit, summarizeCamp } from '@/lib/survival/memory';
import { energyWord, moraleWord, warmthWord } from '@/lib/survival/read';
import { advanceTick } from '@/lib/survival/simulate';
import { nearestTileOfKind } from '@/lib/survival/spatial';
import { survivalStore } from '@/lib/survival/store';
import { profile } from '@/lib/profile/store';
import type { CampState, Task, TaskKind } from '@/lib/survival/types';

/* ============================================================================
   SURVIVAL — "Adapt". A genuinely different loop from Main Evolution:
   SCOUT → ASSESS → PRIORITIZE → ASSIGN → ADAPT over a small, spatial camp,
   not a crafting bench. No shared UI chrome with Sandbox.tsx on purpose —
   see docs/ROADMAP-UNIVERSE.md on why a new mode must not just be the
   existing loop with new restrictions. The whole mode is lazy-loaded (see
   components/AppRoot.tsx) so entering Main Evolution never downloads it.
   ========================================================================== */

const TILE_LABEL: Record<string, string> = { water: 'Water', woodland: 'Woodland', open: 'Open ground', rock: 'Rock', camp: 'Camp' };
const ASSIGNABLE: { kind: TaskKind; label: string }[] = [
  { kind: 'fetch-water', label: 'Water' },
  { kind: 'gather-food', label: 'Food' },
  { kind: 'gather-wood', label: 'Wood' },
  { kind: 'tend-fire', label: 'Fire' },
  { kind: 'build-shelter', label: 'Shelter' },
  { kind: 'rest', label: 'Rest' },
];

function resolveTask(camp: CampState, kind: TaskKind): Task {
  const at = (x: number, y: number): Task => ({ kind, x, y });
  if (kind === 'fetch-water') { const t = nearestTileOfKind(camp.terrain, 'water'); return t ? at(t.x, t.y) : at(camp.terrain.campX, camp.terrain.campY); }
  if (kind === 'gather-wood') { const t = nearestTileOfKind(camp.terrain, 'woodland'); return t ? at(t.x, t.y) : at(camp.terrain.campX, camp.terrain.campY); }
  if (kind === 'gather-food') {
    const t = nearestTileOfKind(camp.terrain, 'open') ?? nearestTileOfKind(camp.terrain, 'woodland');
    return t ? at(t.x, t.y) : at(camp.terrain.campX, camp.terrain.campY);
  }
  return at(camp.terrain.campX, camp.terrain.campY);
}

export function SurvivalMode({ onExit }: { onExit: () => void }) {
  // This component is only ever mounted client-side (dynamic import with
  // ssr: false in components/AppRoot.tsx), so reading localStorage in the
  // lazy initializer is safe and needs no effect of its own.
  const [camp, setCamp] = useState<CampState | null>(() => {
    survivalStore.load();
    return survivalStore.get().active ?? generateCamp(`run-${Date.now()}`);
  });
  const [pending, setPending] = useState<Record<string, TaskKind>>({});

  useEffect(() => {
    if (!camp) return;
    if (!survivalStore.get().active) survivalStore.setActive(camp);
    profile.recordModeVisit('survival');
    // Only ever needs to run once, on mount — camp updates afterward go
    // through advance()/startNewRun(), which persist explicitly themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!camp) return null;

  const advance = () => {
    const assignments: Record<string, Task> = {};
    for (const m of camp.members) {
      if (m.injured) continue;
      const kind = pending[m.id] ?? 'idle';
      assignments[m.id] = resolveTask(camp, kind);
    }
    const { state } = advanceTick(camp, assignments);
    setCamp(state);
    setPending({});
    if (state.ending !== 'ongoing') {
      survivalStore.archiveActive(summarizeCamp(state));
      const exhibit = memoryExhibit(summarizeCamp(state));
      profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'survival', unlockedAt: Date.now() });
    } else {
      survivalStore.setActive(state);
    }
  };

  const startNewRun = () => {
    const fresh = generateCamp(`run-${Date.now()}`);
    setCamp(fresh);
    setPending({});
    survivalStore.setActive(fresh);
  };

  if (camp.ending !== 'ongoing') {
    const memory = summarizeCamp(camp);
    return (
      <div id="survival-mode" className={`sv-ending sv-${memory.ending}`}>
        <div className="sv-ending-box">
          <p className="mono sv-eyebrow">Survival — Adapt</p>
          <h1 className="sv-ending-title">{memory.ending === 'success' ? 'The group held on.' : 'The group could not go on.'}</h1>
          <p className="sv-ending-line">{memory.headline}</p>
          <ol className="sv-log">
            {camp.log.slice(-8).map((e, i) => <li key={i}>Day {e.day}, {e.period} — {e.text}</li>)}
          </ol>
          <div className="sv-ending-actions">
            <button className="chip" onClick={startNewRun}>Start a new run</button>
            <button className="chip" onClick={onExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="survival-mode">
      <header className="sv-top">
        <button className="chip sv-exit" onClick={onExit}>← Hub</button>
        <p className="mono sv-eyebrow">Survival — Adapt</p>
        <p className="sv-daycount">Day {camp.day} of {camp.objective.targetDay} · {camp.period}</p>
      </header>

      <div className="sv-body">
        <section className="sv-map" aria-label="Camp surroundings">
          {camp.terrain.tiles.map((row, y) => (
            <div className="sv-row" key={y}>
              {row.map((tile, x) => (
                <div key={x} className={`sv-tile sv-${tile}`} title={TILE_LABEL[tile]}>
                  {tile === 'camp' && (
                    <svg className={`sv-camp-mark${camp.fire.lit ? ' is-lit' : ''}`} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      {camp.fire.lit
                        ? <path d="M8 1.5c1 2.5-2 3-1.6 5.4C4.8 6.3 4 8 4 9.5a4 4 0 0 0 8 0c0-3-2-4-1.5-6.5-.7.8-1 1.6-.8 2.6C9 4.2 8.6 2.8 8 1.5Z" fill="currentColor" stroke="none" />
                        : <path d="M2 14 8 2l6 12H2Z" fill="none" stroke="currentColor" strokeWidth="1.4" />}
                    </svg>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className="sv-status">
          <div className="sv-resources">
            <div><span className="mono">Food</span><b>{camp.resources.food.toFixed(1)}</b></div>
            <div><span className="mono">Water</span><b>{camp.resources.water.toFixed(1)}</b></div>
            <div><span className="mono">Wood</span><b>{camp.resources.wood.toFixed(1)}</b></div>
            <div><span className="mono">Fire</span><b>{camp.fire.lit ? 'Lit' : 'Out'}</b></div>
            <div><span className="mono">Shelter</span><b>{['None', 'Windbreak', 'Lean-to', 'Solid'][camp.shelter.level]}</b></div>
          </div>

          <ol className="sv-log sv-log-small">
            {camp.log.slice(-4).map((e, i) => <li key={i}>{e.text}</li>)}
          </ol>
        </section>
      </div>

      <section className="sv-roster">
        {camp.members.map(m => (
          <div key={m.id} className={`sv-member${m.injured ? ' is-injured' : ''}`}>
            <div className="sv-member-head">
              <span className="sv-member-name">{m.name}</span>
              <span className="mono sv-member-trait">{m.trait.replace('-', ' ')}</span>
            </div>
            {m.injured ? (
              <p className="sv-member-injured">Can go no further without rest and care.</p>
            ) : (
              <>
                <p className="sv-member-states mono">{energyWord(m.energy)} · {warmthWord(m.warmth)} · {moraleWord(m.morale)}</p>
                <div className="sv-tasks">
                  {ASSIGNABLE.map(t => (
                    <button
                      key={t.kind}
                      className="sv-task-btn"
                      aria-pressed={(pending[m.id] ?? 'idle') === t.kind}
                      onClick={() => setPending(p => ({ ...p, [m.id]: t.kind }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </section>

      <div className="sv-advance-row">
        <p className="sv-advance-hint mono">
          {camp.members.filter(m => !m.injured && !pending[m.id]).length > 0 ? 'Unassigned members will idle this period.' : ` `}
        </p>
        <button className="chip sv-advance" onClick={advance}>Advance to {camp.period === 'night' ? 'morning' : ({ morning: 'day', day: 'evening', evening: 'night' } as Record<string, string>)[camp.period]}</button>
      </div>
    </div>
  );
}
