/* ============================================================================
   SOUND — the one door every sound goes through.

   The synthesis lives in lib/craft/audio.ts (material sounds and interface
   cues, all generated, no files). This module is the public face: components
   never import that file, they say what happened — `sfx('discovery')` — and
   the mapping from event to sound lives here, in one table, so the whole
   soundscape can be tuned or muted from a single place.

   Rules: nothing plays until a gesture has unlocked audio; nothing plays
   while sound is off; nothing loud, ever (the master gain is low and every
   cue is short or slow-swelling rather than sharp).
   ========================================================================== */

import {
  cue, play, setSoundEnabled, soundEnabled, subscribeSound, tunnelRise, unlockAudio,
  type CueId,
} from './craft/audio';
import type { SoundId } from './craft/types';

export type Sfx =
  | 'hover' | 'select' | 'drag' | 'drop' | 'combine' | 'discovery' | 'major' | 'hidden'
  | 'era' | 'archive' | 'graph' | 'tab' | 'begin' | 'flash' | 'stone' | 'refuse';

/** Cue-backed events. */
const CUES: Partial<Record<Sfx, CueId>> = {
  hover: 'hover', select: 'select', tab: 'tab', archive: 'archive', graph: 'graph',
  combine: 'combine', discovery: 'discovery', major: 'major', hidden: 'hidden', era: 'era',
  begin: 'begin', flash: 'flash', stone: 'stone', refuse: 'refuse',
};
/** Events that reuse a material sound. */
const MATERIAL: Partial<Record<Sfx, { id: SoundId; vol: number; rate?: number }>> = {
  drag: { id: 'rustle', vol: 0.25, rate: 1.2 },
  drop: { id: 'thud', vol: 0.35, rate: 1.3 },
};

export const sound = {
  /** Call from a pointer or key handler: browsers only allow audio after a gesture. */
  unlock: unlockAudio,
  enabled: soundEnabled,
  set: setSoundEnabled,
  subscribe: subscribeSound,
  /** Something happened. */
  sfx(name: Sfx, vol?: number) {
    const c = CUES[name];
    if (c) { cue(c, { vol }); return; }
    const m = MATERIAL[name];
    if (m) play(m.id, { vol: (vol ?? 1) * m.vol, rate: m.rate });
  },
  /** The scenery answering a click: a drop on water, a brush of grass, a puff of dust.
   *  The caller supplies the variation (pitch, loudness, stereo position). */
  scene(kind: 'water' | 'grass' | 'dust', o: { vol?: number; rate?: number; pan?: number } = {}) {
    play(kind === 'water' ? 'plip' : kind === 'grass' ? 'rustle' : 'puff', o);
  },
  /** The rush of the time tunnel; call the returned function to fade it out. */
  tunnel: tunnelRise,
};

export { soundEnabled, subscribeSound, setSoundEnabled };
