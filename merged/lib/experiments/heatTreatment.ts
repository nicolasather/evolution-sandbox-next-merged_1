/* ============================================================================
   HEAT TREATMENT EXPERIMENT — the first Experiment Workspace vertical slice.
   Anchored to a real discovery already in the database (`heat_treatment`,
   data/db.json — "Heating a material to change its internal structure, not
   just its temperature", l3: heat-treated stone shows "a distinctive glossy
   fracture surface"). The two variables below and their failure modes are a
   game-appropriate abstraction of real heat-treatment behaviour: too fast a
   ramp causes thermal shock (moisture trapped in the stone flashes to steam
   and cracks it — a documented failure mode in real flintknapping), too much
   heat damages the structure instead of refining it, and too little never
   reaches the temperature/duration the change needs.

   Pure and deterministic on purpose — a controlled experiment should behave
   the same way for the same inputs, which is itself part of what it teaches
   (see lib/seed.ts's doc comment on why UI-visible systems should not run on
   raw Math.random).
   ========================================================================== */

export interface HeatTreatmentInput {
  /** 0–100: how hot, and how quickly the heat was brought up. */
  intensity: number;
  /** 0–100: how long the heat was sustained once reached. */
  duration: number;
}

export type HeatTreatmentOutcome = 'underfired' | 'success' | 'thermal-shock' | 'overheated';

export interface HeatTreatmentResult {
  outcome: HeatTreatmentOutcome;
  /** What happened, physically — never a bare pass/fail. */
  description: string;
  /** One line naming the variable relationship this run demonstrates, for
   *  the Notebook's auto-summary — see components/experiments/. */
  insight: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function runHeatTreatment(input: HeatTreatmentInput): HeatTreatmentResult {
  const intensity = clamp(input.intensity);
  const duration = clamp(input.duration);

  if (intensity > 70 && duration < 35) {
    return {
      outcome: 'thermal-shock',
      description: 'A sharp crack, and a piece shears away as it heats — the surface warmed faster than the moisture inside could escape.',
      insight: 'High heat brought up quickly shocks the stone before duration matters.',
    };
  }
  if (intensity > 85) {
    return {
      outcome: 'overheated',
      description: 'The stone discolours unevenly, and the edge crumbles under a light strike — too hot for too long damages the structure rather than refining it.',
      insight: 'Beyond a point, more heat stops helping and starts breaking the material down.',
    };
  }
  if (intensity < 30 || duration < 20) {
    return {
      outcome: 'underfired',
      description: 'Nothing visibly changes. Struck the same as before it went near the fire — not enough heat reached the material for long enough.',
      insight: 'Both heat and time have a threshold; under either, nothing happens at all.',
    };
  }
  return {
    outcome: 'success',
    description: 'The surface takes on a faint gloss, and a test strike comes away clean and predictable — the internal structure has changed.',
    insight: 'A moderate, sustained heat — not the most intense, not the shortest — is what actually works.',
  };
}
