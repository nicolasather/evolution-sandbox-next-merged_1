'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Engine } from './engine';

/* ============================================================================
   DRAGCRAFT — pointer-driven drag physics for moving a discovery onto the
   bench, replacing the native HTML5 drag-and-drop this list used before.

   A tap still just places the item (unchanged). Only once the pointer moves
   past a small threshold does this take over: a ghost of the item follows
   the pointer with a touch of lag, leans toward whichever slot it is near,
   glows when that pairing is one the game actually knows, and either snaps
   home on a valid drop or springs back to where it started. Works the same
   for mouse, pen and touch — it is all built on Pointer Events.

   Plain DOM + Web Animations, same discipline as lib/fx.ts: no React state,
   so a drag never causes a re-render. The one thing other components need
   to react to (which slot is currently the target, and whether the pairing
   would work) is published through a tiny external-store event, the same
   pattern SceneBackdrop and InventoryRail already use for their own prefs.
   ========================================================================== */

const THRESHOLD = 5; // px of movement before a tap becomes a drag

export const DRAG_EVENT = 'evo:drag';
export interface DragSnapshot { which: 'a' | 'b' | null; compatible: boolean | null; itemId: string | null }
let snapshot: DragSnapshot = { which: null, compatible: null, itemId: null };

export function getDragSnapshot(): DragSnapshot { return snapshot; }
export function subscribeDrag(cb: () => void): () => void {
  window.addEventListener(DRAG_EVENT, cb);
  return () => window.removeEventListener(DRAG_EVENT, cb);
}
function publish(next: DragSnapshot) {
  snapshot = next;
  window.dispatchEvent(new Event(DRAG_EVENT));
}

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function slotEl(which: 'a' | 'b') {
  return document.querySelector<HTMLElement>(`.slot[data-which="${which}"]`);
}

/** Which of the two slots (if any) a point sits inside, with a little extra
 *  reach beyond the circle so the pairing "wants" to catch the item. */
function hitSlot(x: number, y: number): 'a' | 'b' | null {
  for (const which of ['a', 'b'] as const) {
    const el = slotEl(which);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const reach = Math.max(r.width, r.height) * 0.62;
    if (Math.hypot(x - cx, y - cy) < reach) return which;
  }
  return null;
}

const LONG_PRESS_MS = 550;

export interface DragCraftOptions {
  id: string;
  originEl: HTMLElement;
  engine: Engine;
  getSlots: () => { a: string | null; b: string | null };
  onDrop: (which: 'a' | 'b', id: string) => void;
  /** Touch's stand-in for a right-click: held past LONG_PRESS_MS without
   *  moving into a drag. Never armed for a mouse, which already has one. */
  onLongPress?: (x: number, y: number) => void;
}

/** Call from a pointerdown on a draggable item. Does nothing (and costs
 *  nothing) until the pointer actually moves past the threshold — until
 *  then the element's own onClick still fires normally for a tap. */
export function armItemDrag(e: ReactPointerEvent<HTMLElement>, opts: DragCraftOptions) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const { id, originEl, engine, getSlots, onDrop, onLongPress } = opts;
  const startX = e.clientX, startY = e.clientY;
  const pointerId = e.pointerId;
  let dragging = false;
  let ghost: HTMLElement | null = null;
  let raf = 0;
  let gx = startX, gy = startY, tx = startX, ty = startY;
  let lastWhich: 'a' | 'b' | null = null;

  const suppressNextClick = (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); };
  const suppressUpcomingClick = () => {
    originEl.addEventListener('click', suppressNextClick, { capture: true, once: true });
    window.setTimeout(() => originEl.removeEventListener('click', suppressNextClick, { capture: true }), 400);
  };

  let longPressTimer = 0;
  let longPressed = false;
  if (onLongPress && e.pointerType !== 'mouse') {
    longPressTimer = window.setTimeout(() => {
      longPressTimer = 0;
      longPressed = true;
      suppressUpcomingClick();
      onLongPress(tx, ty);
    }, LONG_PRESS_MS);
  }
  const clearLongPress = () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = 0; } };

  const compatFor = (which: 'a' | 'b'): boolean | null => {
    const slots = getSlots();
    const other = which === 'a' ? slots.b : slots.a;
    if (!other || other === id) return null;
    return !!engine.recipeFor(other, id);
  };

  const startGhost = () => {
    dragging = true;
    originEl.classList.add('dragging');
    const r = originEl.getBoundingClientRect();
    ghost = originEl.cloneNode(true) as HTMLElement;
    ghost.classList.add('fx-ghost', 'drag-ghost');
    ghost.removeAttribute('style');
    Object.assign(ghost.style, {
      position: 'fixed', left: `${r.left}px`, top: `${r.top}px`,
      width: `${r.width}px`, height: `${r.height}px`, margin: '0',
      zIndex: '195', pointerEvents: 'none', transformOrigin: 'center',
    });
    document.body.appendChild(ghost);
    gx = r.left + r.width / 2; gy = r.top + r.height / 2;
    tx = gx; ty = gy;
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const tick = () => {
    raf = 0;
    if (!ghost) return;
    const lerp = reduced() ? 1 : 0.32;
    gx += (tx - gx) * lerp; gy += (ty - gy) * lerp;
    const which = hitSlot(tx, ty);
    const lean = which ? 0.22 : 0;
    const target = which ? slotEl(which) : null;
    let ox = gx, oy = gy;
    if (target) {
      const r = target.getBoundingClientRect();
      ox = gx + (r.left + r.width / 2 - gx) * lean;
      oy = gy + (r.top + r.height / 2 - gy) * lean;
    }
    const scale = which ? 0.94 : 1;
    ghost.style.left = `${ox - ghost.offsetWidth / 2}px`;
    ghost.style.top = `${oy - ghost.offsetHeight / 2}px`;
    ghost.style.transform = `scale(${scale})`;

    if (which !== lastWhich) {
      lastWhich = which;
      publish({ which, compatible: which ? compatFor(which) : null, itemId: id });
    }
    if (Math.abs(tx - gx) > 0.4 || Math.abs(ty - gy) > 0.4 || which) raf = requestAnimationFrame(tick);
  };

  const settle = (dropped: boolean, which: 'a' | 'b' | null) => {
    if (raf) cancelAnimationFrame(raf);
    originEl.classList.remove('dragging');
    publish({ which: null, compatible: null, itemId: null });
    if (!ghost) return;
    const g = ghost;
    if (dropped && which) {
      const target = slotEl(which);
      if (target) {
        const r = target.getBoundingClientRect();
        const anim = g.animate([
          { left: g.style.left, top: g.style.top, opacity: 1 },
          { left: `${r.left + r.width / 2 - g.offsetWidth * 0.31}px`, top: `${r.top + r.height / 2 - g.offsetHeight * 0.31}px`, transform: 'scale(.62)', opacity: 0 },
        ], { duration: reduced() ? 1 : 220, easing: 'cubic-bezier(.3,.7,.2,1)' });
        anim.onfinish = () => g.remove();
        anim.oncancel = () => g.remove();
        return;
      }
    }
    // no valid drop — spring back home
    const home = originEl.getBoundingClientRect();
    const anim = g.animate([
      { left: g.style.left, top: g.style.top, transform: g.style.transform || 'scale(1)' },
      { left: `${home.left}px`, top: `${home.top}px`, transform: 'scale(1)' },
    ], { duration: reduced() ? 1 : 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    anim.onfinish = () => g.remove();
    anim.oncancel = () => g.remove();
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (longPressed) return; // already resolved as a long-press, not a drag
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      clearLongPress(); // real movement — this is a drag, not a hold
      startGhost();
    }
    tx = ev.clientX; ty = ev.clientY;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    clearLongPress();
    if (dragging) {
      const which = hitSlot(ev.clientX, ev.clientY);
      settle(!!which, which);
      if (which) onDrop(which, id);
      // a drag just happened — the browser's own synthetic click for this
      // press must not also fire and re-place the item
      suppressUpcomingClick();
    }
  };
  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    clearLongPress();
    if (dragging) settle(false, null);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onCancel, { passive: true });
}
