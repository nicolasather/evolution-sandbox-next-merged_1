import type { Engine } from '../engine';
import type { Certainty } from '../world/types';
import type { MuseumExhibit } from './types';

/* ============================================================================
   AUTO-EXHIBIT PIPELINE — kept for compatibility. Since the Museum redesign
   the player's own finds are shown by the Personal Discovery wing
   (lib/museum/personal/), never among humanity's canonical exhibits.
   One exhibit per major invention the player has already found (lib/world/'s
   `engine.majorsFound()`), needing no separate mode. Every exhibit is
   explicitly labelled a reconstruction (never a specific surviving object,
   never a real accession number) and carries the discovery's own citations
   — see lib/museum/types.ts's ExhibitProvenance doc comment on why that
   distinction matters. Deterministic and idempotent: the same save produces
   the same exhibit list, in the same order, every time.
   ========================================================================== */

const CERTAINTY_NOTE: Record<Certainty, string> = {
  firm: 'Representative reconstruction of a well-documented early form.',
  regional: 'Representative reconstruction — origin traced to a region, not a single site.',
  debated: 'Representative reconstruction — origin and dating are actively debated among researchers.',
  multiple: 'Representative reconstruction — independently invented in more than one region.',
  unknown: 'Representative reconstruction — origin not established.',
};

export function autoExhibits(engine: Engine): MuseumExhibit[] {
  return engine.majorsFound().map(m => {
    const node = engine.get(m.id);
    const sourceIds = node?.src.filter(s => s !== 'source_required') ?? [];
    return {
      id: `major:${m.id}`,
      title: m.displayName ?? m.name,
      discoveryId: m.id,
      provenance: {
        kind: 'reference-reconstruction',
        sourceIds,
        note: CERTAINTY_NOTE[m.certainty],
      },
      sourceMode: 'main-evolution',
      layout: m.tier === 'A' ? 'pedestal' : 'wall-document',
      createdAt: engine.whenFound(m.id) ?? 0,
      tags: [m.civ, m.period].filter((x): x is string => !!x),
    } satisfies MuseumExhibit;
  });
}
