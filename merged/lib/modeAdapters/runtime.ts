import type { Db, Discovery } from '../types';
import type { ModeId } from '../modes/types';
import modePacketsJson from '@/data/verified/mode_packets.json';
import { ADAPTERS, resolvePacket } from './index';

/* The part of the adapters that the real modes CALL.

   Two rules keep the existing game untouched:
   1. adapterGate(): the original catalogue is never filtered. Only items published by the verified-content
      pipeline (they carry `visualArchetype`) must pass their mode's adapter before the mode may offer them.
   2. generatedPackets(): packets shipped in data/verified/mode_packets.json are used only if they validate AND
      simulate as solvable. The file ships empty, so today this returns [] and no mode changes at all. */

type D = Pick<Db, 'nodes'> & { eras?: Db['eras'] };

const withEras = (db: D): Pick<Db, 'nodes' | 'eras'> => ({ nodes: db.nodes, eras: db.eras ?? [] });

/** May this mode offer this item? Original items: always (unchanged). Pipeline items: only when eligible. */
export function adapterGate(modeId: ModeId, node: Discovery, db: D): boolean {
  if (!node.visualArchetype) return true;
  const a = ADAPTERS[modeId];
  if (!a || a.policy === 'excluded') return false;
  try { return a.eligibility(node, withEras(db)).eligible; } catch { return false; }
}

interface PacketFile { schemaVersion?: number; packets?: Record<string, unknown[]> }

/** Validated + solvable packets for a mode. Never throws; a bad packet is dropped, never half-used. */
export function generatedPackets(modeId: ModeId, db: D, file: PacketFile = modePacketsJson as PacketFile): unknown[] {
  if (file.schemaVersion !== 1 || !file.packets || ADAPTERS[modeId]?.policy !== 'opt_in') return [];
  const list = file.packets[modeId];
  if (!Array.isArray(list)) return [];
  const out: unknown[] = [];
  for (const raw of list.slice(0, 64)) {
    const r = resolvePacket(modeId, raw, 'runtime', withEras(db));
    if (r.source === 'generated' && r.packet) out.push(r.packet);
  }
  return out;
}
