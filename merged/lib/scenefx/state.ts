/* ============================================================================
   SCENEFX STATE — what the pointer-reactive layer needs to know about the
   backdrop that SceneBackdrop draws: which scene is in front, and how far its
   depth layers have drifted with the mouse. A plain module (not React state)
   because the parallax changes every frame and only the hit-test reads it.
   ========================================================================== */

export const sceneState = {
  /** Id of the scene currently in front ('' until one has loaded). */
  id: '',
  /** Eased parallax, -1…1 on each axis (the same numbers that move the layers). */
  px: 0,
  py: 0,
};

/** The horizontal / vertical travel of a layer with data-depth 1, in scene units. Mirrors SceneBackdrop. */
export const PARALLAX_X = 26;
export const PARALLAX_Y = 12;
