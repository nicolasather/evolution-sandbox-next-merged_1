/* ============================================================================
   RETENTION BUS — a tiny typed event channel between the game and the optional
   layer. Producers (useSandbox, Workbench, panels) only ever EMIT facts that
   already happened; consumers (achievements, daily objectives, easter eggs,
   NPCs, the companion) only react. Nothing here can change what the Engine
   decides, grant an item, or alter a recipe.
   ========================================================================== */
import type { EraId, Rarity } from '../types';

export type TactileGesture =
  | 'grab' | 'tap' | 'doubleTap' | 'press' | 'rub' | 'shake' | 'swirl' | 'throw'
  | 'impact' | 'bounce' | 'land' | 'spin' | 'near';

export type RetentionEvent =
  | { t: 'discovery'; id: string; status: 'new' | 'known'; newRoute: boolean; era: EraId; rar: Rarity; hidden: boolean }
  | { t: 'attempt-fail'; kind: string }
  | { t: 'technique'; action: string; produced: boolean }
  | { t: 'inspect'; id: string; owned: boolean; era: EraId }
  | { t: 'study'; id: string }
  | { t: 'museum'; exhibitId: string }
  | { t: 'scene'; id: string; era: EraId; auto: boolean }
  | { t: 'tactile'; gesture: TactileGesture; material: string; itemId: string }
  | { t: 'npc'; id: string; stage: 'met' | 'quest-open' | 'quest-done' }
  | { t: 'minpath'; solved: boolean }
  | { t: 'egg'; id: string }
  | { t: 'share'; id: string }
  | { t: 'view'; view: string }
  | { t: 'sticker'; id: string }
  | { t: 'event'; id: string; stage: 'seen' | 'done' }
  /** small named facts from the UI that only the easter-egg layer cares about ('home', 'panel-close', 'hint'…) */
  | { t: 'signal'; name: string; id?: string };

type Handler = (e: RetentionEvent) => void;

const handlers = new Set<Handler>();

export const retentionBus = {
  on(h: Handler): () => void { handlers.add(h); return () => { handlers.delete(h); }; },
  emit(e: RetentionEvent) {
    for (const h of [...handlers]) {
      try { h(e); } catch { /* an optional consumer must never break the game */ }
    }
  },
};

/* ── the arbiter: one voice at a time ─────────────────────────────────── */

export type Channel = 'success' | 'npc' | 'egg' | 'event' | 'failure' | 'companion' | 'tactile';

/** Higher number wins. A lower channel waits while a higher one is playing. */
const PRIORITY: Record<Channel, number> = { success: 6, npc: 5, egg: 4, event: 3, failure: 2, companion: 1, tactile: 0 };

interface Claim { ch: Channel; until: number }

class Arbiter {
  private claims: Claim[] = [];
  private mutedUntil = 0;

  private prune(now: number) { this.claims = this.claims.filter(c => c.until > now); }

  /** True when `ch` may start now; it then holds the floor for `ms`. */
  request(ch: Channel, ms: number, now = performance.now()): boolean {
    this.prune(now);
    if (now < this.mutedUntil && PRIORITY[ch] < PRIORITY.success) return false;
    const p = PRIORITY[ch];
    for (const c of this.claims) {
      if (c.ch === ch) return false;               // never overlap itself
      if (PRIORITY[c.ch] > p) return false;        // something more important is on
    }
    this.claims.push({ ch, until: now + ms });
    return true;
  }
  /** Would `ch` be allowed right now? (does not take the floor) */
  canPlay(ch: Channel, now = performance.now()): boolean {
    this.prune(now);
    if (now < this.mutedUntil && PRIORITY[ch] < PRIORITY.success) return false;
    return !this.claims.some(c => c.ch === ch || PRIORITY[c.ch] > PRIORITY[ch]);
  }
  /** After a discovery, everything quieter keeps still for a beat. */
  hush(ms: number, now = performance.now()) { this.mutedUntil = Math.max(this.mutedUntil, now + ms); }
  release(ch: Channel) { this.claims = this.claims.filter(c => c.ch !== ch); }
  reset() { this.claims = []; this.mutedUntil = 0; }
}

export const arbiter = new Arbiter();
