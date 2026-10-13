/** One short instruction plus the real control(s) that should glow while it is current. */
export interface GuideStep {
  /** Unique per sub-step; a change of id restarts the short pause before the next glow. */
  id: string;
  /** The micro-instruction: normally 2–5 words, upper-case, imperative. */
  text: string;
  /** Target keys the mode's own components look up with `glow(key)`. Several only when each is an equally valid choice. */
  targets: string[];
  /** Optional longer explanation, opened on request. Never a substitute that changes the meaning of `text`. */
  detail?: string;
  /** Fuller description for screen readers when `text` alone would be too terse. */
  sr?: string;
}
