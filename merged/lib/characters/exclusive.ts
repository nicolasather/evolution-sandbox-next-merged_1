/* Mode-exclusive acting. Most clips are for anywhere, but some belong to one kind of work: digging is for a dig, the lever for the escape
   room, merging for the bench. The director never plays a clip in a mode that is not on its list. */
import type { CharacterMode } from './types';

const BENCH: CharacterMode[] = ['main-evolution', 'civilization'];

const ACT: Record<string, CharacterMode[]> = {
  'act-dig': ['survival', 'archaeology'],
  'act-lever': ['escape-room'],
  'act-open-door': ['escape-room', 'civilization'],
  'act-examine-artifact': ['archaeology', 'alien-archaeology'],
  'act-read-clue': ['escape-room', 'decipher', 'archaeology'],
  'act-write': ['archaeology', 'decipher', 'civilization'],
  'act-draw-diagram': ['civilization', 'reverse-evolution', 'minimum-path', 'decipher'],
  'act-connect-evidence': ['archaeology', 'escape-room', 'alien-archaeology', 'decipher'],
  'act-examine-evidence': ['archaeology', 'escape-room', 'alien-archaeology'],
  'act-inspect-map': ['survival', 'minimum-path', 'civilization'],
  'act-carry-materials': ['survival', 'civilization'],
  'act-defend': ['survival', 'civilization', 'alien-archaeology'],
  'act-flee-danger': ['survival', 'civilization', 'alien-archaeology'],
  'act-hide': ['survival', 'civilization', 'alien-archaeology'],
  'act-reverse': ['reverse-evolution', 'minimum-path'],
  'act-discover': ['archaeology', 'alien-archaeology', 'survival'],
};

const MODE_PREFIX: [string, CharacterMode][] = [
  ['mode-survival-', 'survival'], ['mode-civilization-', 'civilization'], ['mode-archaeology-', 'archaeology'], ['mode-escape-', 'escape-room'],
  ['mode-decipher-', 'decipher'], ['mode-alien-', 'alien-archaeology'], ['mode-reverse-', 'reverse-evolution'], ['mode-path-', 'minimum-path'],
  ['sv-', 'survival'], ['cv-', 'civilization'], ['ar-', 'archaeology'], ['er-', 'escape-room'], ['dc-', 'decipher'], ['al-', 'alien-archaeology'],
  ['re-', 'reverse-evolution'], ['mp-', 'minimum-path'],
];

/** The modes a clip is exclusive to, or null when it may be played anywhere. */
export function exclusiveTo(clipId: string): readonly CharacterMode[] | null {
  if (ACT[clipId]) return ACT[clipId];
  const p = MODE_PREFIX.find(([x]) => clipId.startsWith(x));
  if (p) return [p[1]];
  if (clipId.startsWith('craft-') || clipId.startsWith('me-') || clipId === 'guide-demonstrate-combine') return BENCH;
  return null;
}

export const clipAllowedIn = (clipId: string, mode: CharacterMode): boolean => {
  const only = exclusiveTo(clipId);
  return !only || only.includes(mode);
};
