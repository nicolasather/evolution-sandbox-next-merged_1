import type { CampState } from '@/lib/survival/types';
import type { GuideStep } from './types';

/* SURVIVAL GUIDE — first period only: give each member a task, then advance. The guide never picks the task. */

export const SURVIVAL_MODE = 'survival';
export const SV_TARGET = { member: (id: string) => `sv-member:${id}`, advance: 'sv-advance' } as const;

export interface SurvivalGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export function survivalGuide(camp: CampState | null, pending: Record<string, string>, hasPastRuns: boolean): SurvivalGuide {
  const eligible = !hasPastRuns;
  if (!camp || camp.ending !== 'ongoing') return { step: null, finished: !!camp, eligible };
  // Past the first period of the run: the beginner guide has done its job.
  if (camp.day > 1 || camp.period !== 'morning') return { step: null, finished: true, eligible };
  const idle = camp.members.find(m => !m.injured && !pending[m.id]);
  if (idle) {
    return { eligible, finished: false, step: { id: `assign:${idle.id}`, text: 'GIVE EACH PERSON A TASK', targets: [SV_TARGET.member(idle.id)], detail: 'Water, food and a fire keep the group alive; shelter and rest protect it. Anyone left without a task simply idles for this period.' } };
  }
  return { eligible, finished: false, step: { id: 'advance', text: 'ADVANCE THE PERIOD', targets: [SV_TARGET.advance], detail: 'Everyone carries out their task, then you see what changed.' } };
}
