'use client';

import { Glyph } from '../Glyph';
import { cn } from '@/lib/utils';
import { requestReplay } from '@/lib/world/bus';
import type { Engine } from '@/lib/engine';
import type { Certainty } from '@/lib/world/types';
import { WorldMap } from './WorldMap';

/* ============================================================================
   WORLD ORIGINS — the archive's view of the world map: every major invention
   by era, where it is known to have started, and (for the ones already
   found) a way to watch its reveal again, quietly.

   Undiscovered majors stay closed exactly like the rest of the archive: no
   name, no place. Hidden ones show only that they exist.
   ========================================================================== */

const CERTAINTY: Record<Certainty, string | null> = {
  firm: null, regional: 'Region-level', debated: 'Origin debated', multiple: 'Several early centres', unknown: 'Origin unknown',
};

export function WorldOrigins({ engine, onOpen }: { engine: Engine; onOpen: (id: string) => void }) {
  const sum = engine.worldSummary();
  const found = engine.majorsFound();
  const points = found.filter(m => m.precision !== 'unlocated').map(m => ({ id: m.id, lat: m.lat, lon: m.lon, name: m.name }));
  const latest = found.length ? found[found.length - 1].id : null;
  const eras = engine.db.eras
    .map(e => ({ e, list: (engine.world.inEra.get(e.id) ?? []).map(id => engine.world.get(id)!).filter(Boolean), p: engine.eraProgress(e.id) }))
    .filter(x => x.list.length > 0);

  return (
    <div className="wo">
      <div className="wo-head">
        <p className="wo-lead">
          <b className="num">{sum.found}</b> of <span className="num">{sum.total}</span> major inventions are on your map,
          across <b className="num">{sum.regionsRepresented}</b> of <span className="num">{sum.regionsTotal}</span> regions.
        </p>
        <WorldMap className="wm" points={points} latest={latest} label={`World map with ${points.length} major inventions marked`} />
      </div>

      {eras.map(({ e, list, p }) => (
        <section key={e.id} className="wo-era" aria-label={e.name}>
          <h3 className="wo-h">
            <span>{e.name}</span>
            <span className="mono wo-h-n">
              {p.required ? `${p.requiredDone} / ${p.required} required` : 'optional'}
              {!p.open && !p.complete && ' · locked'}
            </span>
          </h3>
          <div className="wo-grid">
            {list.map(m => {
              const node = engine.get(m.id);
              const known = engine.has(m.id);
              const mystery = m.hidden && !known;
              const note = known ? CERTAINTY[m.certainty] : null;
              if (!known) {
                return (
                  <div key={m.id} className={cn('wo-card locked', mystery && 'mystery')} data-id={m.id}>
                    {node && <Glyph node={node} locked />}
                    <span className="wo-n">{mystery ? '?????????' : 'Not yet found'}</span>
                    <span className="wo-m mono">{mystery ? 'Hidden major' : m.required ? 'Required' : 'Optional'}</span>
                  </div>
                );
              }
              return (
                <div key={m.id} className="wo-card" data-id={m.id}>
                  {node && <Glyph node={node} />}
                  <button type="button" className="wo-n wo-open" onClick={() => onOpen(m.id)}>{m.name}</button>
                  <span className="wo-m mono">{m.region} · {m.period}</span>
                  <span className="wo-f">{m.fact}</span>
                  {note && <span className="wo-c mono">{note}</span>}
                  <button type="button" className="chip wo-replay" onClick={() => requestReplay(m.id)}
                    aria-label={`Watch ${m.name} on the globe again`}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M1.5 8h13M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>
                    Watch again
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
