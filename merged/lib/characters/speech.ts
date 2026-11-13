/* One voice at a time. A single arbiter decides whether a line may be shown; there is exactly one `current` bubble, a
   single `pending` slot (never a backlog), and lines go stale rather than appearing late. */
import { LINE_MAX_MS, LINE_MIN_MS } from './dialogue';
import { PRIORITY_RANK, type CharacterId, type SpeechRequest } from './types';

export interface ShownLine extends SpeechRequest { shownAt: number; until: number }

export class SpeechArbiter {
  current: ShownLine | null = null;
  private pending: SpeechRequest | null = null;
  private lastGlobal = -Infinity;
  private lastBy: Partial<Record<CharacterId, number>> = {};
  private ambientGap = 0;
  private subs = new Set<(l: ShownLine | null) => void>();

  constructor(private now: () => number = () => Date.now(), private random: () => number = Math.random) {
    this.ambientGap = this.rollGap();
  }

  private rollGap() { return 35_000 + this.random() * 25_000; }
  private duration(text: string) { return Math.max(LINE_MIN_MS, Math.min(LINE_MAX_MS, 700 + text.length * 70)); }

  subscribe(fn: (l: ShownLine | null) => void): () => void { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  private publish() { for (const s of [...this.subs]) s(this.current); }

  /** Expire the current line and promote a still-fresh pending one. Call from the single scheduler tick. */
  tick(): void {
    const t = this.now();
    if (this.current && t >= this.current.until) { this.current = null; this.publish(); }
    if (!this.current && this.pending) {
      const p = this.pending; this.pending = null;
      if (p.expiresAt > t) this.show(p);
    }
  }

  private show(req: SpeechRequest) {
    const t = this.now();
    this.current = { ...req, shownAt: t, until: t + this.duration(req.text) };
    this.lastGlobal = t; this.lastBy[req.speakerId] = t;
    if (req.priority === 'ambient') this.ambientGap = this.rollGap();
    this.publish();
  }

  /** Offer a line. Returns whether it was shown (or kept pending). `explicit` = the player clicked for a reaction. */
  offer(req: SpeechRequest, explicit = false): boolean {
    this.tick();
    const t = this.now();
    if (req.expiresAt <= t) return false;
    const gap = t - this.lastGlobal;
    const by = t - (this.lastBy[req.speakerId] ?? -Infinity);
    if (!explicit) {
      if (req.priority === 'ambient' && gap < this.ambientGap) return false;
      if (req.priority === 'normal' && (gap < 4000 || by < 10_000)) return false;
    }
    if (!this.current && !explicit && PRIORITY_RANK[req.priority] >= PRIORITY_RANK.major && gap < 1500) return false;
    if (this.current) {
      if (PRIORITY_RANK[req.priority] > PRIORITY_RANK[this.current.priority]) { this.show(req); return true; } // pre-empt
      if (req.priority !== 'ambient') { this.pending = !this.pending || PRIORITY_RANK[req.priority] >= PRIORITY_RANK[this.pending.priority] ? req : this.pending; return true; }
      return false;
    }
    this.show(req);
    return true;
  }

  clear(): void { this.current = null; this.pending = null; this.publish(); }
  hasPending(): boolean { return !!this.pending; }
}
