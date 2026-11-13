/* Clip construction core: the registry and the K() builder. Clip libraries (clips.ts, clips2.ts) import from here. */
import { parseSpec } from './clipdsl';
import type { CharacterId, ClipCategory, ClipDef, FxKind, Pose, PropKind } from './types';

const ALL: readonly CharacterId[] = ['kip', 'vex', 'orra'];

export interface Opt { loop?: boolean; hold?: boolean; fx?: FxKind[]; travel?: number; prop?: PropKind; roles?: string[]; ease?: string; solid?: boolean }

const CATEGORY_OF: [string, ClipCategory][] = [
  ['idle-', 'idle'], ['walk-', 'walk'], ['jump-', 'jump'], ['fall-', 'jump'], ['recover-', 'jump'], ['emotion-', 'emotion'],
  ['cheer-', 'cheer'], ['guide-', 'guide'], ['object-', 'object'], ['prank-', 'prank'], ['mode-', 'mode'], ['fight-', 'fight'],
  ['duet-', 'social'], ['trio-', 'social'], ['pal-', 'social'], ['act-', 'mode'], ['sv-', 'mode'], ['cv-', 'mode'], ['ar-', 'mode'], ['er-', 'mode'], ['dc-', 'mode'], ['al-', 'mode'], ['re-', 'mode'], ['mp-', 'mode'], ['me-', 'mode'], ['move-', 'walk'], ['emote-', 'emotion'], ['silly-', 'jump'], ['adv-', 'jump'], ['item-', 'object'], ['craft-', 'object'], ['screen-', 'entrance'], ['entrance-', 'entrance'], ['exit-', 'entrance'], ['transform-', 'entrance'],
];

const FALLBACK: Record<ClipCategory, Pose> = {
  idle: { body: { sy: 1.02 } }, walk: { body: { y: -1 } }, jump: { body: { sy: 1.05 } }, emotion: { head: { r: 6 } },
  cheer: { body: { sy: 1.07 }, armL: { r: 40 }, armR: { r: -40 } }, guide: { armR: { r: -50 } }, object: { armL: { r: 25 }, armR: { r: -25 } },
  prank: { eye: { sy: 0.6 } }, mode: { head: { r: 5 } }, fight: { body: { r: 4 } }, social: { head: { r: -5 } }, entrance: { root: { o: 0.85 } },
};

export const CLIPS: ClipDef[] = [];
export const BY_ID = new Map<string, ClipDef>();

export function K(id: string, ms: number, spec: string, o: Opt = {}): void {
  const cat = CATEGORY_OF.find(([p]) => id.startsWith(p))![1];
  const keyframes = parseSpec(spec);
  const roles = o.roles?.map(parseSpec);
  const def: ClipDef = {
    id, category: cat, durationMs: ms, keyframes, roles, cast: (1 + (roles?.length ?? 0)) as 1 | 2 | 3,
    easing: o.ease ?? 'ease-in-out', loop: !!o.loop, interruptible: !o.solid, exitPose: 'idle',
    reducedMotionFallback: { durationMs: 240, pose: FALLBACK[cat] }, characters: ALL, travel: o.travel, prop: o.prop, fx: o.fx, holdEnd: o.hold,
    beats: keyframes.length - 2, description: id.replace(/-/g, ' '),
  };
  const old = BY_ID.get(id);
  if (old) {
    // an accidental duplicate is a bug (tests make it fatal); a hot reload re-running this file must simply replace the clip
    if (process.env.NODE_ENV === 'test') throw new Error(`duplicate clip ${id}`);
    CLIPS[CLIPS.indexOf(old)] = def; BY_ID.set(id, def);
    return;
  }
  CLIPS.push(def); BY_ID.set(id, def);
}

