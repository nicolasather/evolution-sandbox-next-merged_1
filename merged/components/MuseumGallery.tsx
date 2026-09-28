'use client';

import { useSyncExternalStore } from 'react';
import { Plate3D } from './Plate3D';
import { siteExhibit } from '@/lib/archaeology/memory';
import { archaeologyStore } from '@/lib/archaeology/store';
import { dioramaExhibit } from '@/lib/civilization/memory';
import { civilizationStore } from '@/lib/civilization/store';
import { decipherExhibit } from '@/lib/decipher/memory';
import { decipherStore } from '@/lib/decipher/store';
import { autoExhibits } from '@/lib/museum/registry';
import type { MuseumExhibit } from '@/lib/museum/types';
import { memoryExhibit } from '@/lib/survival/memory';
import { survivalStore } from '@/lib/survival/store';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   MUSEUM — the automatic-exhibit gallery: one wing, always on, needing no
   separate mode of its own. Three exhibit sources feed it today: Main
   Evolution's own majors (lib/museum/registry.ts's autoExhibits, reusing
   Plate3D — no new rendering pipeline), Survival's Camp Memories
   (lib/survival/memory.ts) and Civilization's Dioramas
   (lib/civilization/memory.ts) — the brief's cross-mode "the world
   remembers" requirement, working end to end rather than only planned.
   Clicking a Main Evolution card opens the same ExhibitPanel every other
   view uses; a Camp Memory or Diorama has no canonical discovery to open,
   so its card just carries its own honest label and note.

   Deliberately plain: this is one honest wing, not the finished museum
   from the brief (curator layout, cases, dioramas as 3D scenes). Every
   exhibit here already carries its own honest provenance note — see
   lib/museum/types.ts.
   ========================================================================== */

export function MuseumGallery({ engine, version, active, onOpen }: {
  engine: Engine;
  version: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  void version; // re-render when the engine's version changes (new finds)
  const survivalVersion = useSyncExternalStore(survivalStore.subscribe, survivalStore.getVersion, () => 0);
  void survivalVersion;
  const civVersion = useSyncExternalStore(civilizationStore.subscribe, civilizationStore.getVersion, () => 0);
  void civVersion;
  const archVersion = useSyncExternalStore(archaeologyStore.subscribe, archaeologyStore.getVersion, () => 0);
  void archVersion;
  const decVersion = useSyncExternalStore(decipherStore.subscribe, decipherStore.getVersion, () => 0);
  void decVersion;

  const mainExhibits = active ? autoExhibits(engine) : [];
  const campExhibits: MuseumExhibit[] = active ? survivalStore.get().memories.map(memoryExhibit) : [];
  const dioramaExhibits: MuseumExhibit[] = active ? civilizationStore.get().dioramas.map(dioramaExhibit) : [];
  const siteExhibits: MuseumExhibit[] = active ? archaeologyStore.get().reports.map(siteExhibit) : [];
  const decipherExhibits: MuseumExhibit[] = active ? decipherStore.get().memories.map(decipherExhibit) : [];
  const staticExhibits = [...campExhibits, ...dioramaExhibits, ...siteExhibits, ...decipherExhibits];
  const exhibits = [...mainExhibits, ...staticExhibits];

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-museum" role="tabpanel" aria-label="Museum">
      <div className="museum-wrap">
        <header className="museum-head">
          <p className="mono museum-eyebrow">Evolution Sandbox</p>
          <h1 className="museum-title">Museum</h1>
          <p className="museum-sub">
            Every major invention you have reached, every camp your Survival runs left behind, every
            settlement your Civilization runs grew, every report your Archaeologist digs filed, and
            every tablet set your Decipher runs read — reconstructed and labelled, never claimed as
            the object or event itself.
          </p>
        </header>

        {exhibits.length === 0 ? (
          <p className="museum-empty">Nothing on display yet. Reach a major invention, or finish a Survival, Civilization, Archaeologist or Decipher run, and it will appear here.</p>
        ) : (
          <div className="museum-grid">
            {mainExhibits.map(ex => {
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
            {staticExhibits.map(ex => (
              <div key={ex.id} className="museum-card museum-card-static">
                <span className="museum-card-title">{ex.title}</span>
                {ex.tags && ex.tags.length > 0 && <span className="museum-card-tags mono">{ex.tags.join(' · ')}</span>}
                <span className="museum-card-note">{ex.provenance.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
