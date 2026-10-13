import type { ReverseRunState } from '@/lib/reverseevolution/types';
import type { GuideStep } from './types';

/* REVERSE EVOLUTION GUIDE — derived from the run (which question is live) and from how many
   options the player has ticked. The guide never says which option is right. */

export const REVERSE_MODE = 'reverse-evolution';
export const REV_TARGET = { card: 'rev-target', option: 'rev-option', submit: 'rev-submit' } as const;

export interface ReverseGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

/** A beginner has answered fewer than two questions in the run on screen. */
const ANSWERED_TO_FINISH = 2;

export function reverseGuide(state: ReverseRunState | null, selectedCount: number): ReverseGuide {
  if (!state) {
    return {
      eligible: true, finished: false,
      step: { id: 'pick-target', text: 'PICK A DISCOVERY', targets: [REV_TARGET.card], detail: 'Any of these works. You will trace what it was really made from, step by step, back to raw materials.' },
    };
  }
  const answered = state.correctCount + state.revealedCount;
  if (state.ending === 'complete' || answered >= ANSWERED_TO_FINISH) return { step: null, finished: true, eligible: true };
  if (selectedCount === 0) {
    return {
      eligible: true, finished: false,
      step: { id: 'choose-parts', text: 'TICK WHAT IT WAS MADE FROM', targets: [REV_TARGET.option], detail: 'Tick every discovery you think was combined to make it. A wrong guess is fine: the real answer is shown and you keep going. If you are unsure, "Just show me" reveals it.' },
    };
  }
  return {
    eligible: true, finished: false,
    step: { id: 'submit', text: 'SUBMIT YOUR ANSWER', targets: [REV_TARGET.submit], detail: 'You see the real recipe straight away, right or wrong.' },
  };
}
