/** Every experience the Mode Hub can eventually host. Listed in full (not
 *  just the ones that exist yet) so registry entries, save/profile keys and
 *  future PRs all agree on one spelling for each mode's id — see
 *  docs/ROADMAP-UNIVERSE.md for what each one is. Adding a real mode later
 *  should never require renaming an id already written into saved profiles. */
export type ModeId =
  | 'main-evolution'
  | 'survival'
  | 'civilization'
  | 'archaeology'
  | 'escape-room'
  | 'decipher'
  | 'alien-archaeology'
  | 'reverse-evolution'
  | 'minimum-path';

/** 'available' is the only status the Mode Hub will ever render a launchable
 *  card for. 'in-development' entries exist in the registry (so the rest of
 *  the architecture — profile visits, museum provenance, save namespacing —
 *  has a stable id to point at while a mode is being built) but are never
 *  shown to players as a locked or "coming soon" placeholder; see
 *  components/ModeHub.tsx. */
export type ModeStatus = 'available' | 'in-development';

export interface ModeDefinition {
  id: ModeId;
  /** The conceptual name from the design brief (e.g. "The Timeline" for Main
   *  Evolution). Not necessarily the final in-game copy. */
  title: string;
  subtitle: string;
  /** One line describing what the player DOES, not marketing adjectives. */
  description: string;
  status: ModeStatus;
  /** The save key this mode's own progress lives under, independent of the
   *  shared profile and of every other mode's save. Main Evolution's stays
   *  the existing `evo.sandbox.v1`, unchanged. */
  saveKey: string;
}
