/* ============================================================================
   FX — small interaction effects, done with plain DOM so they never cause a
   React re-render: a ring-and-sparks burst wherever a control is pressed, a
   ghost of an inventory icon flying to the bench slot it lands in, and the
   immersive shell (auto-hiding top bar, full screen).
   Everything here respects prefers-reduced-motion.
   ========================================================================== */

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Controls that answer a press with a burst. */
const PRESSABLE = 'button, a[href], [role="tab"], .item, .slot, .p3d';

/** Ring + sparks at a screen point. */
export function burst(x: number, y: number, strong = false) {
  if (reduced()) return;
  const host = document.createElement('div');
  host.className = 'fx-burst' + (strong ? ' strong' : '');
  host.style.transform = `translate(${x}px, ${y}px)`;
  const ring = document.createElement('i');
  ring.className = 'ring';
  host.appendChild(ring);
  const n = strong ? 12 : 7;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'sp';
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = (strong ? 34 : 20) + Math.random() * (strong ? 26 : 14);
    s.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(1)}px`);
    s.style.setProperty('--dy', `${(Math.sin(a) * d).toFixed(1)}px`);
    s.style.animationDelay = `${(Math.random() * 40).toFixed(0)}ms`;
    host.appendChild(s);
  }
  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 900);
}

/** Install the global press listener; returns an uninstaller. */
export function installPressFx(): () => void {
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const t = (e.target as Element | null)?.closest?.(PRESSABLE);
    if (!t || (t as HTMLButtonElement).disabled) return;
    // dragging the 3D plate is not a press
    if (t.classList.contains('p3d')) return;
    burst(e.clientX, e.clientY, t.classList.contains('item') || t.classList.contains('begin'));
  };
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  return () => document.removeEventListener('pointerdown', onDown, { capture: true });
}

/** Fly a copy of an inventory icon to the bench slot it is about to fill. */
export function flyToSlot(from: Element | null, which: 'a' | 'b') {
  if (!from || reduced()) return;
  const slot = document.querySelector<HTMLElement>(`.slot[data-which="${which}"]`);
  if (!slot) return;
  const a = from.getBoundingClientRect();
  const b = slot.getBoundingClientRect();
  if (!a.width || !b.width || b.bottom < 0 || b.top > window.innerHeight) return;

  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.classList.add('fx-ghost');
  ghost.removeAttribute('style');
  Object.assign(ghost.style, {
    position: 'fixed', left: `${a.left}px`, top: `${a.top}px`,
    width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '190', pointerEvents: 'none',
  });
  document.body.appendChild(ghost);

  const size = b.width * 0.62;
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = size / a.width;
  const lift = Math.min(120, Math.abs(dx) * 0.25 + 40);
  const anim = ghost.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(${(1 + s) / 2}) rotate(-12deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, opacity: 0 },
  ], { duration: 460, easing: 'cubic-bezier(.3,.7,.25,1)' });
  anim.onfinish = () => { ghost.remove(); slot.classList.add('landed'); window.setTimeout(() => slot.classList.remove('landed'), 520); };
  anim.oncancel = () => ghost.remove();
}

/* ── immersive shell ─────────────────────────────────────────────────── */

const DESKTOP = '(min-width: 901px) and (hover: hover) and (pointer: fine)';

/** On a desktop with a mouse, the top bar hides and slides down when the
 *  pointer reaches the top edge (or keyboard focus enters it). */
export function installImmersiveTop(): () => void {
  const root = document.documentElement;
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(DESKTOP);
  let hideTimer = 0;
  const top = () => document.getElementById('top');
  const show = () => { window.clearTimeout(hideTimer); root.classList.add('top-show'); };
  const hideSoon = (ms = 420) => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      const t = top();
      if (t && (t.contains(document.activeElement) || t.matches(':hover'))) return;
      root.classList.remove('top-show');
    }, ms);
  };
  const apply = () => {
    root.classList.toggle('immersive', mq.matches);
    if (!mq.matches) root.classList.remove('top-show');
  };
  const onMove = (e: PointerEvent) => {
    if (!mq.matches || e.pointerType !== 'mouse') return;
    const h = top()?.offsetHeight ?? 52;
    if (e.clientY <= 8) show();
    else if (root.classList.contains('top-show') && e.clientY > h + 28) hideSoon();
  };
  const onFocusIn = (e: FocusEvent) => { if (top()?.contains(e.target as Node)) show(); };
  const onFocusOut = () => hideSoon(600);
  const onLeave = (e: MouseEvent) => { if (e.clientY <= 0 && mq.matches) show(); };

  apply();
  mq.addEventListener?.('change', apply);
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  document.documentElement.addEventListener('mouseleave', onLeave);
  return () => {
    window.clearTimeout(hideTimer);
    mq.removeEventListener?.('change', apply);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    root.classList.remove('immersive', 'top-show');
  };
}

export const isFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenElement;

/** Enter browser full screen on a desktop. Must run inside a click. */
export function enterFullscreen(onlyDesktop = true) {
  if (onlyDesktop && !window.matchMedia?.(DESKTOP).matches) return;
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { /* refused: stay windowed */ });
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else enterFullscreen(false);
}
