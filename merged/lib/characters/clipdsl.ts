/* A tiny pose DSL so 240 clips stay readable data instead of 240 hand-written tweens.
   A clip spec is beats joined by "|", each beat "t=pose" (t in 0..1), a pose is space-separated "joint.prop value"
   tokens, e.g.  "0.3=root.y-12 body.sy.9 armL.r150|1="  (an empty pose is the rest pose). */
import type { Joint, Keyframe, Pose, Xf } from './types';

const TOKEN = /^(root|body|head|eye|armL|armR|legs|tail|prop|fx)\.(sx|sy|x|y|r|o)(-?\d*\.?\d+)$/;

export function parsePose(s: string): Pose {
  const pose: Pose = {};
  for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`bad pose token "${tok}"`);
    const j = m[1] as Joint;
    const xf: Xf = (pose[j] ??= {});
    xf[m[2] as keyof Xf] = Number(m[3]);
  }
  return pose;
}

export function parseSpec(spec: string): Keyframe[] {
  const out: Keyframe[] = [];
  for (const beat of spec.split('|')) {
    const i = beat.indexOf('=');
    if (i < 0) throw new Error(`bad beat "${beat}"`);
    const at = Number(beat.slice(0, i));
    if (!Number.isFinite(at) || at < 0 || at > 1) throw new Error(`bad beat time in "${beat}"`);
    out.push({ at: Math.round(at * 1000) / 1000, pose: parsePose(beat.slice(i + 1)) });
  }
  out.sort((a, b) => a.at - b.at);
  if (out[0].at > 0) out.unshift({ at: 0, pose: {} });
  if (out[out.length - 1].at < 1) out.push({ at: 1, pose: {} });
  return out;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Join sub-sequences, each given as [weight, beatsInItsOwnLocal0..1], into one 0..1 timeline. */
export function seq(...parts: [number, string][]): string {
  const total = parts.reduce((s, p) => s + p[0], 0);
  let t0 = 0;
  const beats: string[] = [];
  for (const [w, spec] of parts) {
    const span = w / total;
    for (const b of spec.split('|')) {
      const i = b.indexOf('=');
      const t = Number(b.slice(0, i));
      beats.push(`${r3(t0 + t * span)}=${b.slice(i + 1)}`);
    }
    t0 += span;
  }
  return beats.join('|');
}

/** `n` repeats of f(i, phase) spread over [t0, t1]. */
export function rep(n: number, t0: number, t1: number, f: (i: number, last: boolean) => string): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + ((i + 0.5) / n) * (t1 - t0);
    out.push(`${r3(t)}=${f(i, i === n - 1)}`);
  }
  return out.join('|');
}

/** One hop of height h (in size-hundredths) with squash, stretch, apex pose and a landing squash. */
export const hop = (h: number, extra = '', land = 'body.sy.88 body.sx1.1'): string =>
  `0=|0.12=body.sy.84 body.sx1.12 legs.sy.8|0.45=root.y${-h} body.sy1.12 body.sx.92 legs.sy1.2 ${extra}|0.85=root.y0 ${land} legs.sy.85|1=`;

/** Oscillate one joint property `n` times by `amp`. */
export const osc = (joint: Joint, prop: keyof Xf, amp: number, n: number, t0 = 0.05, t1 = 0.95, base = ''): string =>
  rep(n * 2, t0, t1, i => `${joint}.${prop}${i % 2 ? -amp : amp} ${base}`.trim());

/** Hold a pose between a and b with an eased entry/exit. */
export const hold = (pose: string, a = 0.22, b = 0.8): string => `0=|${a}=${pose}|${b}=${pose}|1=`;

/** A walk of `n` steps: alternating legs, bob, lean and net root travel (travel is applied by the animator via ClipDef.travel). */
export const steps = (n: number, bob: number, lean: number, legs = 16, extra = ''): string =>
  rep(n * 2, 0.04, 0.96, i => `legs.r${i % 2 ? -legs : legs} body.y${i % 2 ? 0 : -bob} body.r${i % 2 ? -lean : lean} ${extra}`.trim());

export const ARMS_UP = 'armL.r150 armR.r-150';
export const ARMS_OUT = 'armL.r70 armR.r-70';
export const ARMS_CLAP_IN = 'armL.r-28 armR.r28';
export const ARMS_CLAP_OUT = 'armL.r40 armR.r-40';
