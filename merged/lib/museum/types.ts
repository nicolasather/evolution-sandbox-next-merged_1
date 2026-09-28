/* ============================================================================
   MUSEUM DATA MODEL — foundation only. No screen reads this yet; it exists so
   every mode that will eventually feed the Museum (Archaeologist, Historical
   Escape Room, Decipher, Alien Archaeology, Survival camp memories,
   Civilization dioramas, and Main Evolution's own automatic showcases) writes
   into one shared shape from the start, instead of each mode inventing its
   own exhibit format later.

   The one rule every exhibit must obey: never let generated or speculative
   content read as verified historical fact. `provenance.kind` is mandatory
   and drives the label the Museum shows — see ExhibitProvenance below.
   ========================================================================== */

/** How an exhibit knows what it claims to be.
 *   historical-fact          — backed by a real citation (data/sources.json).
 *   reference-reconstruction — a plausible, labelled reconstruction of a real
 *                              category of object; not claimed to be a
 *                              specific surviving artifact or a real site.
 *   procedural-fictional     — generated for a specific run/campaign/seed
 *                              (an archaeology dig, an alien ruin, a
 *                              decipherment archive); always fictional.
 *   speculative               — a plausible hypothesis the evidence in a run
 *                              did not fully confirm (kept distinct from
 *                              procedural-fictional so a Museum label can
 *                              say "one interpretation" rather than "fictional"). */
export type ProvenanceKind =
  | 'historical-fact' | 'reference-reconstruction' | 'procedural-fictional' | 'speculative';

export interface ExhibitProvenance {
  kind: ProvenanceKind;
  /** Required in practice when kind is 'historical-fact': ids into data/sources.json. */
  sourceIds?: string[];
  /** The line the Museum prints under the exhibit label, e.g. "Representative
   *  reconstruction — no single surviving example informed this piece" or
   *  "Procedural reconstruction — Archive K-17, seed 88214113". Every
   *  non-historical-fact exhibit should set this; it is how the game keeps
   *  its promise never to let fiction pass silently as record. */
  note?: string;
  /** For procedural-fictional content: the seed that generated it, so the
   *  same save always shows the same exhibit if it is ever regenerated. */
  seed?: string | number;
}

export type ExhibitLayout =
  | 'pedestal' | 'wall-document' | 'exploded-mechanism' | 'context-case'
  | 'timeline-cluster' | 'diorama' | 'interactive-reconstruction';

/** One thing the player can find installed in the Museum. */
export interface MuseumExhibit {
  id: string;
  title: string;
  /** Canonical discovery this illustrates, when there is one (lib/types.ts Discovery.id). */
  discoveryId?: string;
  provenance: ExhibitProvenance;
  /** Which mode produced or unlocked this (lib/modes/types.ts ModeId), for the
   *  "You discovered this through…" provenance line. */
  sourceMode: string;
  layout: ExhibitLayout;
  createdAt: number;
  tags?: string[];
}
