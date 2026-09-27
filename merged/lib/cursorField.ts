'use client';

/* ============================================================================
   CURSOR FIELD — one shared source of real pointer state.

   Several systems each want to know "where is the pointer, how fast is it
   moving, is it active right now" — the reactive background field, and (from
   this phase on) the landing scene's withheld-colour reveal. Before this,
   each one kept its own `pointermove` listener and its own smoothing
   constants (see the previous version of components/fx/ReactiveField.tsx),
   which is exactly the "separate hover code for every component" this module
   replaces: one listener, one smoothing pass, read by as many consumers as
   want it.

   This is deliberately narrow — position, velocity, a smoothed "active"
   amount — not a redesign of any one consumer's own effects (ripples, dust,
   quiet-mode) which stay local to whichever component owns that visual
   language. A consumer that wants those keeps its own logic; it only stops
   tracking the raw pointer itself.

   Reference-counted: call start() when a consumer mounts and stop() when it
   unmounts. The underlying listener + rAF loop exist exactly once no matter
   how many consumers are active, and stop for good once the last one goes
   away (idle work is never left running for a component nobody is using).
   No-ops during SSR (`typeof window === 'undefined'`).
   ========================================================================== */

export interface CursorFieldState {
  /** Smoothed CSS-pixel position (eases toward the real pointer). */
  x: number;
  y: number;
  /** Last real pointer position seen, unsmoothed. */
  tx: number;
  ty: number;
  /** Smoothed velocity, CSS px per animation frame. */
  vx: number;
  vy: number;
  /** 0–1, derived from |velocity| — how fast the cursor is moving right now. */
  speed: number;
  /** 0–1 smoothed: rises while the pointer has moved recently, decays after
   *  it has been still for IDLE_MS. Not the same as "is the mouse present" —
   *  a stopped-but-present cursor settles this back toward 0 on purpose, so
   *  consumers doing a "the world wakes up" effect don't have to know why. */
  active: number;
  /** False until the first real pointer event — before that, x/y/tx/ty are
   *  just the viewport centre and should not be treated as a real position. */
  seen: boolean;
}

type FrameListener = (s: CursorFieldState) => void;

const IDLE_MS = 900;
const POS_EASE = 0.12;
const ACTIVE_EASE_IN = 0.06;
const ACTIVE_EASE_OUT = 0.06;
/** Velocity magnitude (CSS px/frame) that reads as "speed 1.0". */
const SPEED_SCALE = 1 / 26;

class CursorField {
  private state: CursorFieldState = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, speed: 0, active: 0, seen: false };
  private activeTarget = 0;
  private idleTimer = 0;
  private raf = 0;
  private refs = 0;
  private readonly frameListeners = new Set<FrameListener>();

  /** Begin tracking (idempotent per consumer via reference counting). */
  start() {
    if (typeof window === 'undefined') return;
    this.refs++;
    if (this.refs > 1) return;
    if (!this.state.seen) {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      this.state.x = this.state.tx = cx;
      this.state.y = this.state.ty = cy;
    }
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onMove, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Stop tracking; the listener + loop are torn down once every consumer has. */
  stop() {
    if (typeof window === 'undefined') return;
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs > 0) return;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onMove);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.clearTimeout(this.idleTimer);
    cancelAnimationFrame(this.raf);
  }

  /** The current smoothed state. Safe to read every frame — a plain object
   *  reference, never reallocated, so this never triggers a GC pause. */
  get(): CursorFieldState {
    return this.state;
  }

  /** Subscribe to be called once per animation frame while tracking is
   *  active. Returns the unsubscribe function. Prefer `get()` inside a loop
   *  you already run (a canvas rAF, a shader uniform update); use this only
   *  when you have no loop of your own to piggy-back on. */
  onFrame(cb: FrameListener): () => void {
    this.frameListeners.add(cb);
    return () => { this.frameListeners.delete(cb); };
  }

  private onMove = (e: PointerEvent) => {
    this.state.tx = e.clientX;
    this.state.ty = e.clientY;
    this.state.seen = true;
    this.activeTarget = 1;
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => { this.activeTarget = 0; }, IDLE_MS);
  };

  private onVisibility = () => { if (document.hidden) this.activeTarget = 0; };

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    if (document.hidden) return;
    const s = this.state;
    const vx = s.tx - s.x, vy = s.ty - s.y;
    s.x += vx * POS_EASE;
    s.y += vy * POS_EASE;
    s.vx = vx;
    s.vy = vy;
    s.speed = Math.max(0, Math.min(1, Math.hypot(vx, vy) * SPEED_SCALE));
    const ease = this.activeTarget > s.active ? ACTIVE_EASE_IN : ACTIVE_EASE_OUT;
    s.active += (this.activeTarget - s.active) * ease;
    this.frameListeners.forEach(l => l(s));
  };
}

/** One instance for the whole app. Each consumer manages its own start()/stop()
 *  around its own mount lifetime — see components/fx/ReactiveField.tsx. */
export const cursorField = new CursorField();
