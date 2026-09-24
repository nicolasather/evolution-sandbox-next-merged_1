/* ============================================================================
   HOME FLIGHT — a resource taken off the bench is never lost. It leaves the
   scenery as a small ghost of itself and flies to where it lives in the
   inventory, and that entry gives a little answering pulse when it lands.

   Two speeds: a quick, deliberate return (right-click, long-press, Delete)
   and a longer one that carries the momentum of a knock — a body that was
   hit hard enough to fly out through the boundary overshoots a little, then
   curves back. DOM only, one rAF loop per flight, gone when it lands.
   ========================================================================== */

export interface FlightOpts {
  itemId: string;
  /** Viewport px: the body's centre and its diameter. */
  x: number; y: number; size: number;
  /** Inner markup of the body's art (an <svg>). */
  art: string;
  angle?: number;
  /** Velocity at take-off, px/s: the flight continues the motion before it turns. */
  vx?: number; vy?: number;
  duration: number;
  reduced?: boolean;
  onArrive?: () => void;
}

export interface Landing { x: number; y: number; el: HTMLElement | null }

const visible = (r: DOMRect) => r.width > 2 && r.height > 2;

/** Where this item lives on screen right now. Falls back to the inventory's edge, then a corner. */
export function inventoryTarget(itemId: string): Landing {
  if (typeof document === 'undefined') return { x: 0, y: 0, el: null };
  const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(itemId) : itemId.replace(/"/g, '');
  const item = document.querySelector<HTMLElement>(`#inv [data-id="${sel}"]`);
  const list = document.getElementById('inv');
  if (item && list) {
    const r = item.getBoundingClientRect(), lr = list.getBoundingClientRect();
    if (visible(r) && visible(lr)) {
      const cx = r.left + Math.min(28, r.width / 2);
      const cy = Math.max(lr.top + 16, Math.min(lr.bottom - 16, r.top + r.height / 2));
      return { x: cx, y: cy, el: item };
    }
  }
  const tab = document.getElementById('rail-tab');
  if (tab) { const r = tab.getBoundingClientRect(); if (visible(r)) return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: tab }; }
  const rail = document.getElementById('rail');
  if (rail) {
    const r = rail.getBoundingClientRect();
    if (visible(r)) return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2, el: null };
  }
  return { x: 28, y: (typeof window !== 'undefined' ? window.innerHeight : 600) - 28, el: null };
}

const ease = (t: number) => t * t * (3 - 2 * t);

function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Pulse the inventory entry a resource just came home to. */
export function pulseHome(el: HTMLElement | null) {
  if (!el) return;
  el.setAttribute('data-return', '');
  window.setTimeout(() => el.removeAttribute('data-return'), 700);
}

export function flyHome(o: FlightOpts): void {
  if (typeof document === 'undefined') { o.onArrive?.(); return; }
  const ghost = document.createElement('div');
  ghost.className = 'wb-fly';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${o.size}px`; ghost.style.height = `${o.size}px`;
  ghost.innerHTML = `<span class="wb-art">${o.art}</span>`;
  document.body.appendChild(ghost);

  const start = performance.now();
  const dur = o.reduced ? 140 : Math.max(120, o.duration);
  const vx = o.vx ?? 0, vy = o.vy ?? 0;
  const p0x = o.x, p0y = o.y;
  const spin = (o.angle ?? 0);
  let raf = 0;

  const frame = (now: number) => {
    const k = Math.min(1, (now - start) / dur);
    // the target is read every frame: the list may scroll or the rail may open under a flight
    const to = inventoryTarget(o.itemId);
    const dx = to.x - p0x, dy = to.y - p0y;
    const d = Math.hypot(dx, dy) || 1;
    const mom = Math.min(230, Math.hypot(vx, vy) * 0.2);
    const sp = Math.hypot(vx, vy) || 1;
    const p1x = p0x + (vx / sp) * mom, p1y = p0y + (vy / sp) * mom;
    const p2x = to.x - (dx / d) * d * 0.28, p2y = to.y - (dy / d) * d * 0.28 - Math.min(60, d * 0.12);
    const t = o.reduced ? k : ease(k);
    const x = bez(p0x, p1x, p2x, to.x, t), y = bez(p0y, p1y, p2y, to.y, t);
    const s = 1 - 0.62 * t;
    const a = k < 0.82 ? 1 : 1 - (k - 0.82) / 0.18;
    ghost.style.transform = `translate3d(${(x - o.size / 2).toFixed(1)}px, ${(y - o.size / 2).toFixed(1)}px, 0) rotate(${(spin + t * 0.9).toFixed(3)}rad) scale(${s.toFixed(3)})`;
    ghost.style.opacity = a.toFixed(3);
    if (k < 1) { raf = requestAnimationFrame(frame); return; }
    ghost.remove();
    pulseHome(to.el);
    o.onArrive?.();
  };
  raf = requestAnimationFrame(frame);
  // a hidden tab stops rAF; never leave a ghost behind
  window.setTimeout(() => { if (ghost.isConnected) { cancelAnimationFrame(raf); ghost.remove(); o.onArrive?.(); } }, dur + 1500);
}
