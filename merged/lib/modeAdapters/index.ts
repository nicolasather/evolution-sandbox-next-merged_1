import type { Db, Discovery } from '../types';
import type { ModeId } from '../modes/types';
import { buildGraph } from '../minpath/graph';
import { shortestPath } from '../minpath/pathfind';
import { generateRun, isTerminal } from '../reverseevolution/generate';
import { createRng } from '../seed';
import type { ModeAdapter, PacketCheck, Resolved } from './types';

type D = Pick<Db, 'nodes' | 'eras'>;

const isPlaceholder = (n: Discovery) => (n.caution ?? '').toLowerCase().includes('placeholder');
const byId = (db: D) => new Map(db.nodes.map(n => [n.id, n]));
const eraIndex = (db: D, id: string) => db.eras.findIndex(e => e.id === id);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function checkShape(raw: unknown, modeId: ModeId, keys: string[]): string[] {
  if (!isObj(raw)) return ['packet is not an object'];
  const errs: string[] = [];
  if (raw.schemaVersion !== 1) errs.push('schemaVersion must be 1');
  if (raw.modeId !== modeId) errs.push(`modeId must be ${modeId}`);
  for (const k of Object.keys(raw)) if (!['schemaVersion', 'modeId', ...keys].includes(k)) errs.push(`unexpected field ${k}`);
  return errs;
}

const graphEligible = (n: Discovery): { eligible: boolean; reason: string } =>
  isPlaceholder(n) ? { eligible: false, reason: 'placeholder entries never feed generated content' }
    : n.rec && n.rec.length ? { eligible: true, reason: 'has a canonical recipe' }
      : { eligible: false, reason: 'primitive or recipe-less' };

/* ── Minimum Path: {start,target} — proof of solvability is the BFS itself ───────────── */
interface MinPathPacket { schemaVersion: 1; modeId: 'minimum-path'; start: string; target: string }
const minimumPath: ModeAdapter<MinPathPacket> = {
  modeId: 'minimum-path', policy: 'opt_in',
  eligibility: graphEligible,
  validatePacket(raw, db) {
    const errors = checkShape(raw, 'minimum-path', ['start', 'target']);
    const o = raw as Record<string, unknown>;
    const m = byId(db);
    for (const k of ['start', 'target']) {
      const n = typeof o?.[k] === 'string' ? m.get(o[k] as string) : undefined;
      if (!n) errors.push(`${k} is not a catalogue item`);
      else if (isPlaceholder(n)) errors.push(`${k} is a placeholder`);
    }
    if (o?.start === o?.target) errors.push('start equals target');
    return errors.length ? { ok: false, errors } : { ok: true, packet: o as unknown as MinPathPacket };
  },
  simulatePacket(p, db) {
    const path = shortestPath(buildGraph(db), p.start, p.target);
    if (!path) return { solvable: false, detail: 'no connecting path' };
    const hops = path.length - 1;
    return hops >= 2 && hops <= 12 ? { solvable: true, detail: `${hops} hops` } : { solvable: false, detail: `${hops} hops is outside 2–12` };
  },
  fallbackPacket(seed, db) {
    const g = buildGraph(db);
    const ids = db.nodes.filter(n => graphEligible(n).eligible && !n.primitive).map(n => n.id).sort();
    if (ids.length < 2) return null;
    const rng = createRng(`minpath-fallback|${seed}`);
    for (let i = 0; i < 200; i++) {
      const a = ids[Math.floor(rng.next() * ids.length)], b = ids[Math.floor(rng.next() * ids.length)];
      const p = shortestPath(g, a, b);
      if (p && p.length - 1 >= 2 && p.length - 1 <= 12) return { schemaVersion: 1, modeId: 'minimum-path', start: a, target: b };
    }
    return null;
  },
};

/* ── Reverse Evolution: {targetId} — solvable iff the run can be generated ─────────────── */
interface ReversePacket { schemaVersion: 1; modeId: 'reverse-evolution'; targetId: string }
const reverseEvolution: ModeAdapter<ReversePacket> = {
  modeId: 'reverse-evolution', policy: 'opt_in',
  eligibility: graphEligible,
  validatePacket(raw, db) {
    const errors = checkShape(raw, 'reverse-evolution', ['targetId']);
    const o = raw as Record<string, unknown>;
    const n = typeof o?.targetId === 'string' ? byId(db).get(o.targetId) : undefined;
    if (!n) errors.push('targetId is not a catalogue item');
    else if (isPlaceholder(n)) errors.push('targetId is a placeholder');
    else if (isTerminal(n)) errors.push('targetId has no recipe to decompose');
    return errors.length ? { ok: false, errors } : { ok: true, packet: o as unknown as ReversePacket };
  },
  simulatePacket(p, db) {
    try { generateRun(db, 'adapter-check', p.targetId); return { solvable: true, detail: 'run generated' }; }
    catch (e) { return { solvable: false, detail: (e as Error).message }; }
  },
  fallbackPacket(seed, db) {
    const ids = db.nodes.filter(n => graphEligible(n).eligible).map(n => n.id).sort();
    if (!ids.length) return null;
    const rng = createRng(`reverse-fallback|${seed}`);
    return { schemaVersion: 1, modeId: 'reverse-evolution', targetId: ids[Math.floor(rng.next() * ids.length)] };
  },
};

/* ── Main Evolution: a list of catalogue ids the player may be pointed at ───────────────── */
interface CataloguePacket { schemaVersion: 1; modeId: ModeId; itemIds: string[] }
function cataloguePacketAdapter(modeId: ModeId, accepts: (n: Discovery, db: D) => boolean, why: string, maxEra?: string): ModeAdapter<CataloguePacket> {
  return {
    modeId, policy: 'opt_in',
    eligibility: (n, db) => {
      if (isPlaceholder(n)) return { eligible: false, reason: 'placeholder entries never feed generated content' };
      if (maxEra && eraIndex(db, n.era) > eraIndex(db, maxEra)) return { eligible: false, reason: `later than ${maxEra}` };
      return accepts(n, db) ? { eligible: true, reason: why } : { eligible: false, reason: `not ${why}` };
    },
    validatePacket(raw, db) {
      const errors = checkShape(raw, modeId, ['itemIds']);
      const o = raw as Record<string, unknown>;
      const m = byId(db);
      if (!Array.isArray(o?.itemIds) || o.itemIds.length < 1 || o.itemIds.length > 24) errors.push('itemIds must hold 1–24 ids');
      else for (const id of o.itemIds) {
        const n = typeof id === 'string' ? m.get(id) : undefined;
        if (!n) errors.push(`unknown item ${String(id).slice(0, 40)}`);
        else if (!this.eligibility(n, db).eligible) errors.push(`${id} is not eligible for ${modeId}`);
      }
      if (Array.isArray(o?.itemIds) && new Set(o.itemIds).size !== o.itemIds.length) errors.push('duplicate ids');
      return errors.length ? { ok: false, errors } : { ok: true, packet: o as unknown as CataloguePacket };
    },
    simulatePacket: (p, db) => ({ solvable: p.itemIds.every(id => byId(db).has(id)), detail: `${p.itemIds.length} items` }),
    fallbackPacket(seed, db) {
      const ids = db.nodes.filter(n => this.eligibility(n, db).eligible).map(n => n.id).sort();
      if (!ids.length) return null;
      const rng = createRng(`${modeId}-fallback|${seed}`);
      const pick = new Set<string>();
      while (pick.size < Math.min(8, ids.length)) pick.add(ids[Math.floor(rng.next() * ids.length)]);
      return { schemaVersion: 1, modeId, itemIds: [...pick].sort() };
    },
  };
}

const excluded = (modeId: ModeId, reason: string): ModeAdapter<never> => ({
  modeId, policy: 'excluded', exclusionReason: reason,
  eligibility: () => ({ eligible: false, reason }),
  validatePacket: () => ({ ok: false, errors: [`${modeId} is excluded: ${reason}`] }),
  simulatePacket: () => ({ solvable: false, detail: 'excluded' }),
  fallbackPacket: () => null,
});

export const ADAPTERS: Record<ModeId, ModeAdapter<unknown>> = {
  'main-evolution': cataloguePacketAdapter('main-evolution', n => !!n.rec?.length || !!n.primitive, 'a catalogue item with a canonical route'),
  'reverse-evolution': reverseEvolution as ModeAdapter<unknown>,
  'minimum-path': minimumPath as ModeAdapter<unknown>,
  survival: cataloguePacketAdapter('survival', n => n.cat === 'technology' || n.cat === 'material' || n.cat === 'technique', 'a prehistoric material or tool', 'origins'),
  archaeology: cataloguePacketAdapter('archaeology', n => n.cat === 'material' || n.cat === 'technology' || n.cat === 'culture', 'a material find or artefact class', 'civilization'),
  civilization: excluded('civilization', 'Lifelines uses authored districts and its own simulator; catalogue items do not map to its mechanics.'),
  decipher: excluded('decipher', 'Decipher generates invented writing systems on purpose; real items would be a spoiler and a factual risk.'),
  'alien-archaeology': excluded('alien-archaeology', 'Fictional nonhuman civilizations must not be seeded with human historical items.'),
  'escape-room': excluded('escape-room', 'Each room is an authored episode with a hand-verified mechanism; a generated one would not be.'),
};

/**
 * Resolve the packet a mode will actually use. A generated packet is used only if it validates AND simulates as
 * solvable; otherwise the deterministic fallback; otherwise nothing (the mode keeps its own content). Never throws.
 */
export function resolvePacket(modeId: ModeId, generated: unknown | null | undefined, seed: string, db: D): Resolved<unknown> {
  const a = ADAPTERS[modeId];
  const errors: string[] = [];
  if (a.policy === 'excluded') return { source: 'none', packet: null, errors: [a.exclusionReason ?? 'excluded'] };
  if (generated !== null && generated !== undefined) {
    try {
      const v: PacketCheck<unknown> = a.validatePacket(generated, db);
      if (v.ok) {
        const sim = a.simulatePacket(v.packet, db);
        if (sim.solvable) return { source: 'generated', packet: v.packet, errors };
        errors.push(`not solvable: ${sim.detail}`);
      } else errors.push(...v.errors);
    } catch (e) { errors.push(`validator error: ${(e as Error).message}`); }
  }
  try {
    const fb = a.fallbackPacket(seed, db);
    return fb ? { source: 'fallback', packet: fb, errors } : { source: 'none', packet: null, errors };
  } catch (e) {
    return { source: 'none', packet: null, errors: [...errors, `fallback error: ${(e as Error).message}`] };
  }
}
