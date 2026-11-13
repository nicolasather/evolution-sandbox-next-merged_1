/* The playback adapter: turns a ClipDef into native Web Animations on the rig's joints (transform + opacity only), retargeted to
   the character. No setInterval, no per-frame React work; every animation is tracked so cancel() kills them all. */
import { CHARACTERS } from './registry';
import { JOINTS, type CharacterId, type ClipDef, type Joint, type Keyframe as CKeyframe, type Pose, type Xf } from './types';

export interface PlayOpts {
  char: CharacterId;
  /** creature size in px (the DSL's hundredths scale against it) */
  unit: number;
  /** 0..1 amplitude (mobile / low power scale it down) */
  amp?: number;
  /** pick the keyframes of this role in a pair / trio clip (0 = lead) */
  role?: number;
  /** +1 travels right, -1 left */
  dir?: 1 | -1;
  reduced?: boolean;
  /** called once with the net horizontal travel in px, just before the animation is released */
  onTravel?: (dx: number) => void;
  speed?: number;
  /** play the pose only; the caller moves the creature (so it glides continuously and an interrupted walk never snaps back) */
  noTravel?: boolean;
}

export interface Playing {
  cancel(): void;
  /** drop a held end pose (clips that leave the stage keep it until the next clip starts) */
  release(): void;
  finished: Promise<'done' | 'cancelled'>;
  readonly cancelled: boolean;
}

const NOOP: Playing = { cancel() {}, release() {}, finished: Promise.resolve('done'), cancelled: false };

export const supportsAnimation = (el: Element): boolean => typeof (el as HTMLElement).animate === 'function';

function jointEl(root: HTMLElement, j: Joint): HTMLElement | null {
  return j === 'root' ? root : root.querySelector<HTMLElement>(`[data-joint="${j}"]`);
}

/** One joint's WAAPI keyframes: identity at 0 and 1, retargeted, with opacity carried forward for the prop. */
export function buildJointFrames(
  joint: Joint, frames: readonly CKeyframe[], char: CharacterId, unit: number, amp: number, travelPx: number, ease: string,
): Keyframe2[] {
  const rt = CHARACTERS[char].retarget;
  const out: Keyframe2[] = [];
  let lastO = joint === 'prop' ? 0 : 1;
  for (const f of frames) {
    const xf: Xf = f.pose[joint] ?? {};
    const present = f.pose[joint] !== undefined;
    if (!present && f.at !== 0 && f.at !== 1 && !(joint === 'root' && travelPx)) continue;
    const tx = ((xf.x ?? 0) * rt.ax * amp * unit) / 100 + (joint === 'root' ? travelPx * f.at : 0);
    const ty = ((xf.y ?? 0) * rt.ay * amp * unit) / 100;
    const r = (xf.r ?? 0) * rt.ar * (Math.abs(xf.r ?? 0) >= 150 ? 1 : amp);
    const sx = 1 + ((xf.sx ?? 1) - 1) * rt.as * amp;
    const sy = 1 + ((xf.sy ?? 1) - 1) * rt.as * amp;
    if (xf.o !== undefined) lastO = xf.o;
    out.push({
      offset: f.at,
      transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
      opacity: lastO,
      easing: ease,
    });
  }
  if (out[0].offset !== 0) out.unshift({ ...out[0], offset: 0 });
  if (out[out.length - 1].offset !== 1) out.push({ ...out[out.length - 1], offset: 1 });
  return out;
}
export interface Keyframe2 { offset: number; transform: string; opacity: number; easing: string }

export function playClip(root: HTMLElement | null, clip: ClipDef, o: PlayOpts): Playing {
  if (!root || !supportsAnimation(root)) return NOOP;
  const rt = CHARACTERS[o.char].retarget;
  const amp = Math.max(0.2, Math.min(1, o.amp ?? 1));
  const role = o.role ?? 0;
  const frames = role > 0 ? clip.roles?.[role - 1] ?? clip.keyframes : clip.keyframes;
  const anims: Animation[] = [];
  let cancelled = false;
  // line-drawn effect marks (tears, stars, zzz…) are shown only while the clip plays
  const fxOn = !!clip.fx?.length && role === 0;
  if (fxOn) root.setAttribute('data-fx', clip.fx!.join(' '));
  const fxOff = () => { if (fxOn) root.removeAttribute('data-fx'); };
  let travelPx = 0;

  const run = (joint: Joint, fr: Keyframe2[], dur: number, iterations: number) => {
    const el = jointEl(root, joint);
    if (!el) return;
    try {
      const a = el.animate(fr as unknown as Keyframe[], { duration: dur, iterations, fill: 'forwards', easing: 'linear' });
      anims.push(a);
    } catch { /* an element that cannot animate just sits still */ }
  };

  let total: number;
  if (o.reduced) {
    // reduced motion: a short pose swap, no travel, no loops; the meaning (a beat of acknowledgement) survives
    total = clip.reducedMotionFallback.durationMs;
    const pose: Pose = clip.reducedMotionFallback.pose;
    const fb: CKeyframe[] = [{ at: 0, pose: {} }, { at: 0.5, pose }, { at: 1, pose: {} }];
    for (const j of JOINTS) {
      if (!fb.some(f => f.pose[j])) continue;
      run(j, buildJointFrames(j, fb, o.char, o.unit, 0.5, 0, 'ease-out'), total, 1);
    }
  } else {
    total = Math.max(250, clip.durationMs * rt.speed * (o.speed ?? 1));
    travelPx = o.noTravel ? 0 : (clip.travel ?? 0) * o.unit * (o.dir ?? 1) * amp; // noTravel: the stage glides the whole creature instead
    const ease = clip.easing === 'ease-in-out' ? rt.easing : clip.easing;
    for (const j of JOINTS) {
      if (!frames.some(f => f.pose[j]) && !(j === 'root' && travelPx)) continue;
      run(j, buildJointFrames(j, frames, o.char, o.unit, amp, travelPx, ease), total, clip.loop ? Infinity : 1);
    }
  }

  let settleOut: (v: 'done' | 'cancelled') => void = () => {};
  const finished = new Promise<'done' | 'cancelled'>(resolve => {
    settleOut = resolve;
    if (!anims.length) { resolve('done'); return; }
    const last = anims.reduce((a, b) => ((a.effect?.getComputedTiming().endTime as number) ?? 0) >= ((b.effect?.getComputedTiming().endTime as number) ?? 0) ? a : b);
    const settle = () => {
      if (cancelled) { resolve('cancelled'); return; }
      if (travelPx && !o.reduced) { try { o.onTravel?.(travelPx); } catch { /* ignore */ } }
      // commit first (the caller moved the creature), then release the held end pose so there is no snap-back frame
      // (a clip that ends off-stage keeps its last pose until release())
      if (!clip.holdEnd) for (const a of anims) { try { a.cancel(); } catch { /* ignore */ } }
      fxOff();
      resolve('done');
    };
    if (clip.loop && !o.reduced) return; // loops end only by cancel()
    last.finished.then(settle, () => resolve('cancelled'));
  });

  return {
    get cancelled() { return cancelled; },
    release() { for (const a of anims) { try { a.cancel(); } catch { /* ignore */ } } },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      for (const a of anims) { try { a.cancel(); } catch { /* ignore */ } }
      fxOff();
      settleOut('cancelled');
    },
    finished,
  };
}
