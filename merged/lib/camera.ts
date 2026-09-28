'use client';

import { isAttentionClaimed, subscribeAttention } from './attention';
import { cursorField } from './cursorField';
import { getQuality, isCoarsePointer, isPhone, prefersReducedMotion } from './perf';

/* ============================================================================
   CAMERA — P0.2's "the world never feels like a static image" as a real,
   cheap, additive system: not a rewrite of any view into a 3D scene, but a
   shared source of a few CSS custom properties (`--cam-x`, `--cam-y`,
   `--cam-scale`) that `#ground`/`#strata` read in `app/_camera.css`.

   Two independent motions, matching the brief's own split between "normally
   subtle and stable" and "when an important discovery occurs":

     breathe   a slow, tiny, continuous sine drift — the world is never a
               still frame, even with the pointer at rest. Off entirely
               under `prefers-reduced-motion` (a static image is exactly
               what that preference asks for).
     lean      a few pixels of parallax toward the pointer, scaled by
               `cursorField`'s own eased position and `active` (so it fades
               back to centre the moment the pointer goes idle or leaves).
               Skipped on touch/coarse pointers, which have no hover to lean
               toward.
     focus     driven by `lib/attention.ts`, not per-frame: whenever a
               ceremony, era-shift banner or globe moment claims attention,
               the world scales in by a fraction of a percent and holds
               until the claim releases — "the camera gradually moves
               toward the discovery" from the brief, done the cheap way (one
               CSS custom-property write plus a CSS `transition`, not a
               per-frame animation loop of its own).

   No new rAF loop: breathe/lean piggy-back on `cursorField`'s existing
   per-frame subscription (`onFrame`), the same "one shared loop, many
   consumers" shape `cursorField`'s own header already asks for.
   Ref-counted the same way, so mounting `<WorldCamera/>` more than once (it
   shouldn't be, but nothing enforces that) is harmless.
   ========================================================================== */

const BREATHE_PERIOD_MS = 9000;
const BREATHE_AMP_PX = 1.6;
const LEAN_AMP_PX = 5;
const FOCUS_SCALE = 1.006;

let refs = 0;
let unsubFrame: (() => void) | null = null;
let unsubAttention: (() => void) | null = null;
let bootAt = 0;

const set = (name: string, v: string) => {
  document.documentElement.style.setProperty(name, v);
};

function applyAttention() {
  set('--cam-scale', isAttentionClaimed() ? String(FOCUS_SCALE) : '1');
}

/** Start the shared camera system (ref-counted — see `components/world/WorldCamera.tsx`). */
export function startCamera(): void {
  if (typeof window === 'undefined') return;
  refs++;
  if (refs > 1) return;
  bootAt = performance.now();
  applyAttention();
  unsubAttention = subscribeAttention(applyAttention);

  if (prefersReducedMotion()) return; // static camera: exactly what was asked for

  const coarse = isCoarsePointer() || isPhone();
  const ampScale = getQuality() === 'low' ? 0.5 : 1;

  cursorField.start();
  unsubFrame = cursorField.onFrame(s => {
    const t = (performance.now() - bootAt) / BREATHE_PERIOD_MS;
    const bx = Math.sin(t * Math.PI * 2) * BREATHE_AMP_PX * ampScale;
    const by = Math.cos(t * Math.PI * 2 * 0.63) * BREATHE_AMP_PX * 0.6 * ampScale;
    let lx = 0, ly = 0;
    if (!coarse && s.seen) {
      const nx = (s.x / Math.max(1, window.innerWidth) - 0.5) * 2;   // -1..1
      const ny = (s.y / Math.max(1, window.innerHeight) - 0.5) * 2;
      lx = nx * LEAN_AMP_PX * s.active * ampScale;
      ly = ny * LEAN_AMP_PX * 0.6 * s.active * ampScale;
    }
    set('--cam-x', `${(bx + lx).toFixed(2)}px`);
    set('--cam-y', `${(by + ly).toFixed(2)}px`);
  });
}

/** Stop (ref-counted); the underlying subscriptions are torn down once every consumer has. */
export function stopCamera(): void {
  if (typeof window === 'undefined') return;
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  unsubFrame?.(); unsubFrame = null;
  unsubAttention?.(); unsubAttention = null;
  cursorField.stop();
  set('--cam-x', '0px'); set('--cam-y', '0px'); set('--cam-scale', '1');
}
