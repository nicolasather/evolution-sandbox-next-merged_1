import { createHash } from 'node:crypto';
import type { CreativeCatalog } from '../catalog';
import { ADAPTERS } from '@/lib/modeAdapters';
import type { ModeId } from '@/lib/modes/types';
import { solveAlien, solveArchaeology, solveCivilization, solveDecipher, solveEscape, solveSurvival, escapeSecrets, type SolveResult } from './solvers';
import { CERT_SEEDS, POOL_MAX, POOL_MIN, type FlavorField, type PacketModeId, type SolverCertificate } from './types';
import { createRng } from '@/lib/seed';
import { buildGraph } from '@/lib/minpath/graph';
import { shortestPath } from '@/lib/minpath/pathfind';
import { generateRun } from '@/lib/reverseevolution/generate';
import { DEFAULT_EPISODE_ID } from '@/lib/escaperoom/registry';

/* Tickets 094–096 — one contract per mode: which items it may name, which flavour fields exist, which labels the server
   adds, how the server derives its scenario, and which independent solver certifies it. */

export interface ModeContract {
  modeId: PacketModeId;
  contractVersion: string;
  generatorVersion: string;
  flavor: readonly FlavorField[];
  /** may the model pick items from a pool? false => approvedItemIds must be empty (or server-chosen) */
  usesItems: boolean;
  /** flavour-only modes can be auto-served when the owner enables it; graph/scenario modes never are */
  lowRiskFlavorOnly: boolean;
  bannedDigits: boolean;
  disclosure: string | null;
  /** words/names that must not appear in flavour for this mode (computed from the catalogue + the mode's secrets) */
  banned(cat: CreativeCatalog, poolIds: readonly string[]): { names: string[]; secrets: string[] };
  /** deterministic server-side scenario from seed (+ the pool) */
  scenario(cat: CreativeCatalog, seed: number, pickedIds: readonly string[]): Record<string, string | number> | null;
  /** certify 20 derived seeds with the independent solver */
  certify(baseSeed: string, scenario: Record<string, string | number>, cat: CreativeCatalog): { ok: boolean; steps?: number; checks: string[]; failures: string[] };
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const derivedSeeds = (base: string, n = CERT_SEEDS) => Array.from({ length: n }, (_, i) => `${base}#${i}`);
const baseSeed = (modeId: string, seed: number) => `mode-packet|${modeId}|${seed}`;

function runSeeds(base: string, fn: (s: string) => SolveResult, checkName: string) {
  const failures: string[] = []; let steps = Infinity;
  for (const s of derivedSeeds(base)) { const r = fn(s); if (!r.ok) failures.push(`${s}: ${r.detail}`); else if (r.steps !== undefined) steps = Math.min(steps, r.steps); }
  return { ok: failures.length === 0, steps: Number.isFinite(steps) ? steps : undefined, checks: [`${checkName} x${CERT_SEEDS}`], failures };
}

/** names of catalogue items later than `maxRank` (they must not appear) */
function laterNames(cat: CreativeCatalog, maxRank: number, exceptIds: readonly string[]): string[] {
  const out: string[] = [];
  for (const n of cat.db.nodes) { const p = cat.profiles.get(n.id)!; if (p.eraRank > maxRank && !exceptIds.includes(n.id) && n.n.length >= 4) out.push(n.n.toLowerCase()); }
  return out;
}
const poolMax = (cat: CreativeCatalog, ids: readonly string[]) => Math.max(0, ...ids.map(i => cat.profiles.get(i)?.eraRank ?? 0));

export const CONTRACTS: Record<PacketModeId, ModeContract> = {
  survival: {
    modeId: 'survival', contractVersion: 'survival.v1', generatorVersion: 'survival-greedy-1',
    flavor: [{ key: 'opening', maxLen: 200 }, { key: 'biome', maxLen: 160 }, { key: 'closing', maxLen: 160 }],
    usesItems: true, lowRiskFlavorOnly: false, bannedDigits: false, disclosure: null,
    banned: (cat, ids) => ({ names: laterNames(cat, poolMax(cat, ids), ids), secrets: [] }),
    scenario: (_c, seed) => ({ baseSeed: baseSeed('survival', seed) }),
    certify: (b) => runSeeds(b, solveSurvival, 'greedy-care policy reaches the objective day'),
  },
  civilization: {
    modeId: 'civilization', contractVersion: 'civilization.v1', generatorVersion: 'civ-allocation-1',
    flavor: [{ key: 'opening', maxLen: 200 }, { key: 'policyNote', maxLen: 160 }, { key: 'projectNote', maxLen: 160 }],
    usesItems: false, lowRiskFlavorOnly: true, bannedDigits: false, disclosure: null,
    banned: (cat) => ({ names: laterNames(cat, 1, []), secrets: [] }),
    scenario: (_c, seed) => ({ baseSeed: baseSeed('civilization', seed) }),
    certify: (b) => runSeeds(b, solveCivilization, 'an allocation policy reaches resilience'),
  },
  archaeology: {
    modeId: 'archaeology', contractVersion: 'archaeology.v1', generatorVersion: 'arch-reach-1',
    flavor: [{ key: 'siteNarrative', maxLen: 300 }],
    usesItems: true, lowRiskFlavorOnly: false, bannedDigits: false,
    disclosure: 'Simulated site — not a real excavation. Evidence here is ambiguous on purpose.',
    banned: (cat, ids) => ({ names: laterNames(cat, poolMax(cat, ids), ids), secrets: [] }),
    scenario: (_c, seed) => ({ baseSeed: baseSeed('archaeology', seed) }),
    certify: (b) => runSeeds(b, solveArchaeology, 'every find reachable by the mode rules'),
  },
  decipher: {
    modeId: 'decipher', contractVersion: 'decipher.v1', generatorVersion: 'decipher-unique-1',
    flavor: [{ key: 'theme', maxLen: 80 }, { key: 'clueIntro', maxLen: 200 }],
    usesItems: false, lowRiskFlavorOnly: true, bannedDigits: false, disclosure: 'An invented writing system — not a real language.',
    banned: (cat) => ({ names: laterNames(cat, 0, []), secrets: [] }),
    scenario: (_c, seed) => ({ baseSeed: baseSeed('decipher', seed) }),
    certify: (b) => runSeeds(b, solveDecipher, 'unique solution confirmed'),
  },
  'escape-room': {
    modeId: 'escape-room', contractVersion: 'escape.v1', generatorVersion: 'escape-authored-1',
    flavor: [{ key: 'atmosphere', maxLen: 240 }, { key: 'hintTone', maxLen: 160 }],
    usesItems: false, lowRiskFlavorOnly: true, bannedDigits: true, disclosure: null,
    banned: (cat) => ({ names: laterNames(cat, 6, []), secrets: escapeSecrets(DEFAULT_EPISODE_ID) }),
    scenario: () => ({ episodeId: DEFAULT_EPISODE_ID }),
    certify: () => { const r = solveEscape(DEFAULT_EPISODE_ID); return { ok: r.ok, steps: r.steps, checks: ['authored answers complete the episode'], failures: r.ok ? [] : [r.detail] }; },
  },
  'alien-archaeology': {
    modeId: 'alien-archaeology', contractVersion: 'alien.v1', generatorVersion: 'alien-deterministic-1',
    flavor: [{ key: 'siteDescriptor', maxLen: 240 }, { key: 'misdirection', maxLen: 200 }],
    usesItems: false, lowRiskFlavorOnly: false, bannedDigits: false, disclosure: 'Fictional nonhuman civilization — not human history, not a real site.',
    banned: (cat) => ({ names: laterNames(cat, 0, []), secrets: ['earth', 'human'] }),
    scenario: (_c, seed) => ({ baseSeed: baseSeed('alien-archaeology', seed) }),
    certify: (b) => runSeeds(b, solveAlien, 'deterministic site, no preset verdict'),
  },
  'reverse-evolution': {
    modeId: 'reverse-evolution', contractVersion: 'reverse.v1', generatorVersion: 'reverse-graph-1',
    flavor: [{ key: 'framing', maxLen: 200 }],
    usesItems: false, lowRiskFlavorOnly: false, bannedDigits: false, disclosure: null,
    banned: () => ({ names: [], secrets: [] }),
    scenario: (cat, seed) => {
      const fb = ADAPTERS['reverse-evolution'].fallbackPacket(baseSeed('reverse-evolution', seed), cat.db) as { targetId: string } | null;
      return fb ? { baseSeed: baseSeed('reverse-evolution', seed), targetId: fb.targetId } : null;
    },
    certify: (b, sc, cat) => {
      const failures: string[] = [];
      for (const s of derivedSeeds(b, 5)) { try { generateRun(cat.db, s, String(sc.targetId)); } catch (e) { failures.push(`${s}: ${(e as Error).message}`); } }
      const sim = ADAPTERS['reverse-evolution'].simulatePacket({ schemaVersion: 1, modeId: 'reverse-evolution', targetId: sc.targetId }, cat.db);
      if (!sim.solvable) failures.push(sim.detail);
      return { ok: failures.length === 0, checks: ['canonical-graph run generates; decomposition derived from the graph'], failures };
    },
  },
  'minimum-path': {
    modeId: 'minimum-path', contractVersion: 'minpath.v1', generatorVersion: 'minpath-bfs-1',
    flavor: [{ key: 'briefing', maxLen: 200 }],
    usesItems: false, lowRiskFlavorOnly: false, bannedDigits: true, disclosure: null,
    banned: () => ({ names: [], secrets: [] }),
    scenario: (cat, seed) => {
      const fb = ADAPTERS['minimum-path'].fallbackPacket(baseSeed('minimum-path', seed), cat.db) as { start: string; target: string } | null;
      if (!fb) return null;
      const path = shortestPath(buildGraph(cat.db), fb.start, fb.target);
      return path ? { baseSeed: baseSeed('minimum-path', seed), start: fb.start, target: fb.target, hops: path.length - 1 } : null;
    },
    certify: (_b, sc, cat) => {
      const path = shortestPath(buildGraph(cat.db), String(sc.start), String(sc.target));
      const sim = ADAPTERS['minimum-path'].simulatePacket({ schemaVersion: 1, modeId: 'minimum-path', start: sc.start, target: sc.target }, cat.db);
      const ok = !!path && sim.solvable && path.length - 1 === sc.hops;
      return { ok, steps: path ? path.length - 1 : undefined, checks: ['BFS oracle path matches the scenario'], failures: ok ? [] : [sim.detail] };
    },
  },
};

/** The deterministic 10–30 item pool a mode may offer to the model (verified items the mode's own adapter accepts). */
export function poolFor(cat: CreativeCatalog, modeId: PacketModeId, seed: number): string[] {
  const c = CONTRACTS[modeId];
  if (!c.usesItems) return [];
  const a = ADAPTERS[modeId as ModeId];
  const ids = cat.db.nodes.filter(n => cat.profiles.get(n.id)?.status === 'verified' && a.eligibility(n, cat.db).eligible).map(n => n.id).sort();
  if (ids.length < POOL_MIN) return [];
  const rng = createRng(`pool|${modeId}|${seed}`);
  const shuffled = rng.shuffle(ids);
  return shuffled.slice(0, Math.min(POOL_MAX, shuffled.length)).sort();
}
export const poolHash = (ids: readonly string[]) => sha(ids.join('|'));

export function buildCertificate(c: ModeContract, base: string, r: { steps?: number; checks: string[] }): SolverCertificate {
  const body = { generatorVersion: c.generatorVersion, seeds: derivedSeeds(base), reachable: true as const, minSteps: r.steps, checks: r.checks };
  return { ...body, hash: sha(JSON.stringify(body)) };
}
