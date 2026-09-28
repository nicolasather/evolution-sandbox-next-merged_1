'use client';

import { Plate3D } from './Plate3D';
import { autoExhibits } from '@/lib/museum/registry';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   MUSEUM — the automatic-exhibit gallery: one wing, always on, needing no
   separate mode. Every card is a major invention the player has already
   found (lib/museum/registry.ts's autoExhibits), reusing the same Plate3D
   drawing and provenance data the rest of the game already has — no new
   rendering pipeline, no separate 3D engine. Clicking a card opens the same
   ExhibitPanel every other view uses, so the Museum is a lens on the one
   shared collection, not a duplicate one.

   Deliberately plain: this is the first wing, not the finished museum from
   the brief (curator layout, cases, dioramas). Every exhibit here already
   carries its own honest provenance note (never a specific surviving
   object, never a real accession number) — see lib/museum/types.ts.
   ========================================================================== */

export function MuseumGallery({ engine, version, active, onOpen }: {
  engine: Engine;
  version: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  void version; // re-render when the engine's version changes (new finds)
  const exhibits = active ? autoExhibits(engine) : [];

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-museum" role="tabpanel" aria-label="Museum">
      <div className="museum-wrap">
        <header className="museum-head">
          <p className="mono museum-eyebrow">Evolution Sandbox</p>
          <h1 className="museum-title">Museum</h1>
          <p className="museum-sub">
            Every major invention you have reached, reconstructed and labelled — never claimed as the object itself.
          </p>
        </header>

        {exhibits.length === 0 ? (
          <p className="museum-empty">Nothing on display yet. Reach a major invention and it will appear here.</p>
        ) : (
          <div className="museum-grid">
            {exhibits.map(ex => {
              const discoveryId = ex.discoveryId;
              const node = discoveryId ? engine.get(discoveryId) : undefined;
              if (!node || !discoveryId) return null;
              return (
                <button key={ex.id} className="museum-card" onClick={() => onOpen(discoveryId)}>
                  <div className="museum-card-plate"><Plate3D node={node} variant="card" label={ex.title} /></div>
                  <span className="museum-card-title">{ex.title}</span>
                  {ex.tags && ex.tags.length > 0 && <span className="museum-card-tags mono">{ex.tags.join(' · ')}</span>}
                  <span className="museum-card-note">{ex.provenance.note}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
