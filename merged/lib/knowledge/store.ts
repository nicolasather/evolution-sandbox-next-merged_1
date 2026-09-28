/* ============================================================================
   KNOWLEDGE STORE — versioned persistence for DormantRecord (lib/knowledge/
   types.ts). Nothing in this pass calls markDormant(): the store exists,
   works, and is tested now specifically so that wiring a real loss trigger
   later is "call this method somewhere" rather than "design a save format".
   `evo.knowledge.v1`, independent of every other store (Main Evolution's own
   save included) — see docs/ROADMAP-UNIVERSE.md's Lost Knowledge section.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { DormantRecord, FragilityCause, KnowledgeSave } from './types';

const KEY = 'evo.knowledge.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is KnowledgeSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.dormant);
}

function blank(): KnowledgeSave {
  return { v: CURRENT_VERSION, dormant: [] };
}

class KnowledgeStore {
  private data: KnowledgeSave = blank();
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;
  private notify(): void { this.version++; this.listeners.forEach(cb => cb()); }

  load(): void {
    if (!isBrowser()) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const out = runMigrations<KnowledgeSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<KnowledgeSave> { return this.data; }

  isDormant(discoveryId: string): boolean {
    return this.data.dormant.some(d => d.discoveryId === discoveryId);
  }

  /** Not called anywhere yet — see the module doc comment. Idempotent. */
  markDormant(discoveryId: string, cause: FragilityCause, evidenceSurvives: boolean): void {
    if (this.isDormant(discoveryId)) return;
    const record: DormantRecord = { discoveryId, becameDormantAt: Date.now(), cause, evidenceSurvives };
    this.data = { ...this.data, dormant: [...this.data.dormant, record] };
    this.persist();
    this.notify();
  }

  /** Not called anywhere yet — the future "relearn" flow's counterpart to markDormant. */
  relearn(discoveryId: string): void {
    if (!this.isDormant(discoveryId)) return;
    this.data = { ...this.data, dormant: this.data.dormant.filter(d => d.discoveryId !== discoveryId) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const knowledgeStore = new KnowledgeStore();
