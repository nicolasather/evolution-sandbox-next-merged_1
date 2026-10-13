import type { SceneId } from './scenes';

/* ============================================================================
   INTRO VISIT — which cinematic openings have already played during THIS
   website visit.

   A "visit" is the lifetime of the loaded app document: a fresh load or
   reload starts a new one, switching modes inside the app does not. The state
   is deliberately in memory only (never localStorage), so it can never be
   confused with a save, a discovery count or a completion record, and it
   disappears on its own when the page is closed or reloaded.

   The object is created once above the mode switch (components/AppRoot.tsx),
   so it survives every mode unmount and remount.
   ========================================================================== */

export interface IntroVisit {
  /** True when this scene's opening has already been started in this visit. */
  hasSeen(id: SceneId): boolean;
  /** Record that the opening was started (skipping it afterwards still counts). */
  markSeen(id: SceneId): void;
  /**
   * Make every opening eligible again — for a genuinely new visit such as a
   * successful sign-in. The app has no sign-in today; a reload already does this.
   * Gameplay, saves and cinematic-completion records are never touched.
   */
  reset(): void;
  /** Scenes seen so far (read-only snapshot, used by tests and diagnostics). */
  seen(): SceneId[];
}

export function createIntroVisit(): IntroVisit {
  const set = new Set<SceneId>();
  return {
    hasSeen: id => set.has(id),
    markSeen: id => { set.add(id); },
    reset: () => { set.clear(); },
    seen: () => Array.from(set),
  };
}

/** Used when nothing provides a visit (isolated component tests): every opening may play. */
export const ALWAYS_PLAY: IntroVisit = {
  hasSeen: () => false,
  markSeen: () => {},
  reset: () => {},
  seen: () => [],
};
