'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { Plate3D } from './Plate3D';
import { alienExhibit } from '@/lib/alienarchaeology/memory';
import { alienArchaeologyStore } from '@/lib/alienarchaeology/store';
import { siteExhibit } from '@/lib/archaeology/memory';
import { archaeologyStore } from '@/lib/archaeology/store';
import { dioramaExhibit } from '@/lib/civilization/memory';
import { civilizationStore } from '@/lib/civilization/store';
import { decipherExhibit } from '@/lib/decipher/memory';
import { decipherStore } from '@/lib/decipher/store';
import { episodeExhibit } from '@/lib/escaperoom/memory';
import { getEpisode } from '@/lib/escaperoom/registry';
import { escapeRoomStore } from '@/lib/escaperoom/store';
import { autoExhibits } from '@/lib/museum/registry';
import { playDb } from '@/lib/processing';
import { reverseExhibit as reverseTraceExhibit } from '@/lib/reverseevolution/memory';
import { reverseEvolutionStore } from '@/lib/reverseevolution/store';
import type { MuseumExhibit, ProvenanceKind } from '@/lib/museum/types';
import { memoryExhibit } from '@/lib/survival/memory';
import { survivalStore } from '@/lib/survival/store';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   MUSEUM — the automatic-exhibit gallery: always on, needing no separate mode
   of its own. Eight exhibit sources feed it: Main Evolution's own majors
   (lib/museum/registry.ts's autoExhibits, reusing Plate3D — no new
   rendering pipeline) plus one memory source per other mode.

   Curator layout: exhibits are grouped into named WINGS (one per source
   mode) rather than one undifferentiated grid — a wing only ever renders
   when it actually has something in it, same "never a grid of placeholders"
   discipline as lib/modes/registry.ts. Every non-Main-Evolution card gets a
   museum-case treatment: an accent bar in that wing's own established
   mode colour, and a provenance-kind badge, so provenance reads at a glance
   instead of only in the note line underneath.

   Still deliberately short of the brief's full curator vision — actual 3D
   diorama scenes and a walkable case layout remain future work; see this
   file's own "Not built" note in docs/ROADMAP-UNIVERSE.md.
   ========================================================================== */

const KIND_LABEL: Record<ProvenanceKind, string> = {
  'historical-fact': 'Historical fact',
  'reference-reconstruction': 'Reconstruction',
  'procedural-fictional': 'Procedural',
  'speculative': 'Speculative',
};

function CaseCard({ ex, accent }: { ex: MuseumExhibit; accent: string }) {
  return (
    <div className="museum-case" style={{ ['--case-accent' as string]: accent }}>
      <p className="mono museum-case-kind">{KIND_LABEL[ex.provenance.kind]}</p>
      <span className="museum-case-title">{ex.title}</span>
      {ex.tags && ex.tags.length > 0 && <span className="museum-card-tags mono">{ex.tags.join(' · ')}</span>}
      <span className="museum-card-note">{ex.provenance.note}</span>
    </div>
  );
}

function Wing({ id, label, blurb, accent, exhibits, children }: {
  id: string; label: string; blurb: string; accent: string; exhibits: MuseumExhibit[]; children: ReactNode;
}) {
  if (exhibits.length === 0) return null;
  return (
    <section className="museum-wing" aria-label={label}>
      <header className="museum-wing-head">
        <span className="museum-wing-mark" style={{ ['--case-accent' as string]: accent }} aria-hidden="true" />
        <div>
          <h2 className="museum-wing-title">{label}</h2>
          <p className="museum-wing-blurb">{blurb}</p>
        </div>
        <span className="mono museum-wing-count">{exhibits.length}</span>
      </header>
      <div className="museum-grid" id={id}>{children}</div>
    </section>
  );
}

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
  const escVersion = useSyncExternalStore(escapeRoomStore.subscribe, escapeRoomStore.getVersion, () => 0);
  void escVersion;
  const alienVersion = useSyncExternalStore(alienArchaeologyStore.subscribe, alienArchaeologyStore.getVersion, () => 0);
  void alienVersion;
  const revVersion = useSyncExternalStore(reverseEvolutionStore.subscribe, reverseEvolutionStore.getVersion, () => 0);
  void revVersion;

  const mainExhibits = active ? autoExhibits(engine) : [];
  const campExhibits: MuseumExhibit[] = active ? survivalStore.get().memories.map(memoryExhibit) : [];
  const dioramaExhibits: MuseumExhibit[] = active ? civilizationStore.get().dioramas.map(dioramaExhibit) : [];
  const siteExhibits: MuseumExhibit[] = active ? archaeologyStore.get().reports.map(siteExhibit) : [];
  const decipherExhibits: MuseumExhibit[] = active ? decipherStore.get().memories.map(decipherExhibit) : [];
  const escapeExhibits: MuseumExhibit[] = active
    ? escapeRoomStore.get().memories.map(m => episodeExhibit(m, getEpisode(m.episodeId)?.title ?? 'Unknown episode'))
    : [];
  const alienExhibits: MuseumExhibit[] = active ? alienArchaeologyStore.get().reports.map(alienExhibit) : [];
  const reverseExhibits: MuseumExhibit[] = active
    ? reverseEvolutionStore.get().runs.map(m => reverseTraceExhibit(m, playDb.nodes.find(n => n.id === m.targetId)?.n ?? m.targetId))
    : [];
  const exhibits = [
    ...mainExhibits, ...campExhibits, ...dioramaExhibits, ...siteExhibits,
    ...decipherExhibits, ...escapeExhibits, ...alienExhibits, ...reverseExhibits,
  ];

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-museum" role="tabpanel" aria-label="Museum">
      <div className="museum-wrap">
        <header className="museum-head">
          <p className="mono museum-eyebrow">Evolution Sandbox</p>
          <h1 className="museum-title">Museum</h1>
          <p className="museum-sub">
            Every major invention you have reached, every camp your Survival runs left behind, every
            settlement your Civilization runs grew, every report your Archaeologist digs filed, every
            tablet set your Decipher runs read, every Escape Room episode you have opened, every field
            report your Alien Archaeology sites produced, and every discovery your Reverse Evolution
            runs traced back to its origins — reconstructed and labelled, never claimed as the object
            or event itself.
          </p>
        </header>

        {exhibits.length === 0 ? (
          <p className="museum-empty">Nothing on display yet. Reach a major invention, or finish a Survival, Civilization, Archaeologist, Decipher, Escape Room, Alien Archaeology or Reverse Evolution run, and it will appear here.</p>
        ) : (
          <div className="museum-wings">
            <Wing id="wing-timeline" label="The Timeline" blurb="Main Evolution's own majors, reached in this collection." accent="var(--ochre)" exhibits={mainExhibits}>
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
            </Wing>

            <Wing id="wing-survival" label="Survival Camps" blurb="What your Survival runs left behind." accent="#d9a256" exhibits={campExhibits}>
              {campExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#d9a256" />)}
            </Wing>

            <Wing id="wing-civilization" label="Settlements" blurb="Dioramas of the settlements your Civilization runs grew." accent="#2f6b52" exhibits={dioramaExhibits}>
              {dioramaExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#2f6b52" />)}
            </Wing>

            <Wing id="wing-archaeology" label="Archaeological Reports" blurb="Filed reports from your Archaeologist digs." accent="#a15a2a" exhibits={siteExhibits}>
              {siteExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#a15a2a" />)}
            </Wing>

            <Wing id="wing-decipher" label="Decipherment Archive" blurb="Tablet sets your Decipher runs read." accent="#3a5a9c" exhibits={decipherExhibits}>
              {decipherExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#3a5a9c" />)}
            </Wing>

            <Wing id="wing-escaperoom" label="Escape Room Episodes" blurb="Episodes you have opened." accent="#a15a2a" exhibits={escapeExhibits}>
              {escapeExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#a15a2a" />)}
            </Wing>

            <Wing id="wing-alien" label="Alien Ruins" blurb="Field reports your Alien Archaeology sites produced." accent="#6b46a8" exhibits={alienExhibits}>
              {alienExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#6b46a8" />)}
            </Wing>

            <Wing id="wing-reverse" label="Reverse-Traced Objects" blurb="Discoveries your Reverse Evolution runs traced back to their origins." accent="#2f7d6b" exhibits={reverseExhibits}>
              {reverseExhibits.map(ex => <CaseCard key={ex.id} ex={ex} accent="#2f7d6b" />)}
            </Wing>
          </div>
        )}
      </div>
    </section>
  );
}
