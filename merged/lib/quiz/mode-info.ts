/** What each way of playing really supports, derived from the same compatibility rules the server enforces. */
import { allowedFlows, compatibleModifiers } from './compatibility';
import { flowLabels, modeLabels, modifierLabels, type Flow, type PlayMode } from './types';

export type ModeInfo = {
  mode: PlayMode; title: string; art: string; accent: string; summary: string;
  facts: string[]; needsAccountToHost: boolean; flows: { flow: Flow; label: string; modifiers: string[] }[];
};

const base: Record<PlayMode, Pick<ModeInfo, 'art' | 'accent' | 'summary' | 'facts' | 'needsAccountToHost'>> = {
  solo: { art: '/quiz/art/mode-solo.svg', accent: '#FFD52F', needsAccountToHost: false,
    summary: 'One player answers every question alone, against the clock, at their own pace.', facts: ['1 player', 'No account needed'] },
  classroom: { art: '/quiz/art/mode-classroom.svg', accent: '#16C9EF', needsAccountToHost: true,
    summary: 'One teacher computer and a projector. 2–8 teams answer together or take turns. No student devices.', facts: ['2–8 teams', 'Teacher controls the screen'] },
  online: { art: '/quiz/art/mode-online.svg', accent: '#FF386A', needsAccountToHost: true,
    summary: 'Players join from their own devices with a six-character room code. The host runs the room.', facts: ['Join with a room code', 'Host needs an account'] },
};

export function modeInfo(mode: PlayMode): ModeInfo {
  return {
    mode, title: modeLabels[mode], ...base[mode],
    flows: allowedFlows(mode).map((flow) => ({ flow, label: flowLabels[flow], modifiers: compatibleModifiers(mode, flow).map((m) => modifierLabels[m]) })),
  };
}
export const ALL_MODES: PlayMode[] = ['solo', 'classroom', 'online'];
