/** Deterministic game phase machine. Illegal transitions are ignored, so a double event can never skip a phase. */
export type Phase = 'IDLE' | 'LOBBY' | 'QUESTION_ACTIVE' | 'ANSWER_LOCKED' | 'REVEAL' | 'REDEMPTION_ROUND' | 'COMPLETED';
export type PhaseEvent = 'OPEN_LOBBY' | 'START' | 'LOCK' | 'REVEAL' | 'NEXT_QUESTION' | 'START_REDEMPTION' | 'FINISH' | 'RESET';
const T: Record<Phase, Partial<Record<PhaseEvent, Phase>>> = {
  IDLE: { OPEN_LOBBY: 'LOBBY', START: 'QUESTION_ACTIVE' },
  LOBBY: { START: 'QUESTION_ACTIVE', RESET: 'IDLE' },
  QUESTION_ACTIVE: { LOCK: 'ANSWER_LOCKED', RESET: 'IDLE' },
  ANSWER_LOCKED: { REVEAL: 'REVEAL', RESET: 'IDLE' },
  REVEAL: { NEXT_QUESTION: 'QUESTION_ACTIVE', START_REDEMPTION: 'REDEMPTION_ROUND', FINISH: 'COMPLETED', RESET: 'IDLE' },
  REDEMPTION_ROUND: { FINISH: 'COMPLETED', RESET: 'IDLE' },
  COMPLETED: { RESET: 'IDLE' },
};
export function transition(p: Phase, e: PhaseEvent): Phase { return T[p][e] ?? p; }
export const canTransition = (p: Phase, e: PhaseEvent) => !!T[p][e];
