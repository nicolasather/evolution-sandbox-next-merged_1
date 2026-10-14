import type { Db, Discovery } from '../types';
import type { ModeId } from '../modes/types';

/* Each mode declares what it accepts. Adding an item to the catalogue never requires touching a mode:
   a mode either reads items through its adapter's eligibility() or is explicitly excluded, with a reason. */

export interface Eligibility { eligible: boolean; reason: string }
export type PacketCheck<P> = { ok: true; packet: P } | { ok: false; errors: string[] };
export interface Simulation { solvable: boolean; detail: string }

export interface ModeAdapter<P = unknown> {
  modeId: ModeId;
  /** 'opt_in': may use generated packets after validation. 'excluded': keeps its own authored/procedural content. */
  policy: 'opt_in' | 'excluded';
  exclusionReason?: string;
  eligibility(item: Discovery, db: Pick<Db, 'nodes' | 'eras'>): Eligibility;
  validatePacket(raw: unknown, db: Pick<Db, 'nodes' | 'eras'>): PacketCheck<P>;
  simulatePacket(packet: P, db: Pick<Db, 'nodes' | 'eras'>): Simulation;
  /** Deterministic, offline packet. null ⇒ the mode keeps using only what it already has. */
  fallbackPacket(seed: string, db: Pick<Db, 'nodes' | 'eras'>): P | null;
}

export type PacketSource = 'generated' | 'fallback' | 'none';
export interface Resolved<P> { source: PacketSource; packet: P | null; errors: string[] }
