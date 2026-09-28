import type { Migratable } from '../save/types';

/* ============================================================================
   LOST KNOWLEDGE — data model. This pass ships warnings only: a resilience
   score, plain-language causes, and a qualitative state shown in the UI.
   Nothing here ever removes, hides or disables a discovery the player has
   made — Engine.found (lib/engine.ts) is never read or written by this
   module. `DormantRecord`/`KnowledgeSave` exist so that a later pass wiring
   a real loss trigger (a route collapsing, a region's last practitioner
   being lost, …) is a localized addition — a store already versioned and
   already shaped for it — rather than a rewrite touching saves, Graph,
   Timeline, recipes or discovery dependencies.
   ========================================================================== */

export type ResilienceState = 'stable' | 'fragile' | 'at-risk';

/** Each cause explains itself in plain language — see resilience.ts's
 *  RESILIENCE_NOTES. Never shown to the player as a bare code. */
export type FragilityCause =
  | 'single-region'       // the record ties this to one place, and nothing has spread it elsewhere
  | 'undocumented'        // an oral/practice-only category — no durable physical record
  | 'low-redundancy'      // this is the only known way to it — no alternate recipe
  | 'isolated-dependency'; // it leans on another discovery that is itself rare

export interface ResilienceFactor {
  cause: FragilityCause;
  note: string;
}

export interface ResilienceScore {
  discoveryId: string;
  state: ResilienceState;
  /** 0 (about to be lost) – 1 (essentially permanent). Internal — see
   *  resilience.ts's doc comment on why this is never shown raw. */
  score: number;
  factors: ResilienceFactor[];
}

/** Not written by anything in this pass — see the module doc comment above.
 *  `evidenceSurvives` already encodes the brief's "relearning should be
 *  faster if artifacts, records or derivative technologies survive" so a
 *  future relearn-speed system reads it rather than re-deriving it. */
export interface DormantRecord {
  discoveryId: string;
  becameDormantAt: number;
  cause: FragilityCause;
  evidenceSurvives: boolean;
}

export interface KnowledgeSave extends Migratable {
  v: 1;
  dormant: DormantRecord[];
}
