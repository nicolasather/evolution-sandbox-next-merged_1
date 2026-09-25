import { buildPlan, frameAt, type Frame, type Plan, type PlanInput } from './choreography';
import { clamp } from './geo';

/* ============================================================================
   DIRECTOR — the queue and the clock behind the globe.

   The engine can announce several major inventions in a row (a craft that
   yields two, an era finishing on the invention that completes it, a quick
   run of finds). They are queued and played one after another; when a
   backlog builds, each moment is built as the shorter version.

   Skipping never touches game state — progress lives in the engine and was
   saved before the first frame. A skip stops the picture where it is and
   fades it out; Escape drops everything still waiting.

   No DOM, no timers of its own: the caller passes `now` (performance.now())
   into `tick` and `sample`, which keeps every rule here testable.
   ========================================================================== */

/** How long a skipped moment takes to fade away, ms. */
export const SKIP_FADE_MS = 260;
/** The gap between one moment and the next, ms — the bench shows for a breath. */
export const GAP_MS = 140;

export interface Moment<P = unknown> {
  id: number;
  /** Whatever the picture needs to know about this moment (which invention, which era). Opaque here. */
  payload: P;
  /** Built when the moment starts, so it sees the preferences and the backlog of that instant. */
  build: (backlog: number) => PlanInput;
}

interface Current<P> {
  moment: Moment<P>;
  plan: Plan;
  start: number;
  skipAt: number | null;
  /** The plan time the picture was frozen at, when skipped. */
  frozen: number;
}

export interface Sample<P = unknown> {
  moment: Moment<P>;
  plan: Plan;
  frame: Frame;
  elapsed: number;
  /** Input is honoured now (the plan's `skipAfter` has passed and it is not already leaving). */
  canSkip: boolean;
  skipping: boolean;
}

export interface DirectorOptions<P = unknown> {
  /** ms between a moment being queued (with nothing playing) and its first frame. */
  delay?: () => number;
  /** Return false to hold the next moment (a dialog is up, say). Checked on every tick. */
  canStart?: () => boolean;
  /** Whether the next moment may start (the film is over, say). Moved with `setOpen`; open by default. */
  open?: boolean;
  onStart?: (m: Moment<P>, plan: Plan) => void;
  onEnd?: (m: Moment<P>, skipped: boolean) => void;
  /** A moment was dropped from the queue without playing. */
  onDrop?: (m: Moment<P>) => void;
}

export class WorldDirector<P = unknown> {
  private queue: Moment<P>[] = [];
  private cur: Current<P> | null = null;
  private armedAt: number | null = null;
  private listeners = new Set<() => void>();
  /** Bumped whenever something a component would render changes: a moment starts, ends or is skipped. */
  version = 0;
  private open: boolean;

  constructor(private readonly opts: DirectorOptions<P> = {}) { this.open = opts.open ?? true; }

  /** Hold (false) or release (true) the next moment. What is playing is not interrupted. */
  setOpen(open: boolean): void { this.open = open; }

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = (): number => this.version;
  private emit() { this.version++; this.listeners.forEach(fn => fn()); }

  /** Playing, or waiting to play. */
  get busy(): boolean { return this.cur !== null || this.queue.length > 0; }
  get playing(): boolean { return this.cur !== null; }
  /** How many are still to come after the current one. */
  get backlog(): number { return this.queue.length; }
  get current(): Moment<P> | null { return this.cur?.moment ?? null; }

  enqueue(m: Moment<P>, now: number): void {
    this.queue.push(m);
    if (!this.cur && this.armedAt === null) this.armedAt = now + Math.max(0, this.opts.delay?.() ?? 0);
    this.emit();
  }

  /** Advance the clock. Returns true when the set of things on screen changed. */
  tick(now: number): boolean {
    let changed = false;
    const c = this.cur;
    if (c) {
      const done = c.skipAt !== null ? now - c.skipAt >= SKIP_FADE_MS : now - c.start >= c.plan.total;
      if (done) {
        this.cur = null;
        this.opts.onEnd?.(c.moment, c.skipAt !== null);
        this.armedAt = this.queue.length ? now + GAP_MS : null;
        changed = true;
      }
    }
    if (!this.cur && this.queue.length && this.armedAt !== null && now >= this.armedAt && this.open && (this.opts.canStart?.() ?? true)) {
      const m = this.queue.shift()!;
      const plan = buildPlan(m.build(this.queue.length));
      this.cur = { moment: m, plan, start: now, skipAt: null, frozen: 0 };
      this.opts.onStart?.(m, plan);
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /**
   * Skip the current moment once its skip window has opened. `all` also drops
   * everything queued behind it. Returns whether anything was skipped.
   */
  skip(now: number, all = false): boolean {
    const c = this.cur;
    if (all && this.queue.length && (!c || now - c.start >= c.plan.skipAfter)) {
      const dropped = this.queue.splice(0);
      dropped.forEach(m => this.opts.onDrop?.(m));
      this.emit();
      if (!c) return true;
    }
    if (!c || c.skipAt !== null) return false;
    const el = now - c.start;
    if (el < c.plan.skipAfter) return false;
    c.skipAt = now;
    c.frozen = clamp(el, 0, c.plan.total);
    this.emit();
    return true;
  }

  /** What the picture looks like at `now`, or null when nothing is playing. */
  sample(now: number): Sample<P> | null {
    const c = this.cur;
    if (!c) return null;
    const elapsed = now - c.start;
    const skipping = c.skipAt !== null;
    const t = skipping ? c.frozen : elapsed;
    const frame = frameAt(c.plan, t);
    if (skipping) {
      const k = 1 - clamp((now - c.skipAt!) / SKIP_FADE_MS, 0, 1);
      frame.veil *= k; frame.card *= k; frame.title *= k; frame.dots *= k;
      frame.arcAlpha *= k; frame.extras *= k;
    }
    return { moment: c.moment, plan: c.plan, frame, elapsed, skipping, canSkip: !skipping && elapsed >= c.plan.skipAfter };
  }

  /** Drop everything (the game was reset). */
  clear(): void {
    const dropped = this.queue.splice(0);
    dropped.forEach(m => this.opts.onDrop?.(m));
    const c = this.cur;
    this.cur = null; this.armedAt = null;
    if (c) this.opts.onEnd?.(c.moment, true);
    this.emit();
  }
}
