import type { Db, Discovery } from '../types';
import type { Capability, Processing, ProcessingData, StateDef, TransformDef } from './types';

/* ============================================================================
   OVERLAY — lays the processing layer over the authored database WITHOUT
   touching data/db.json. It returns a new Db in which:
   - a few action-like entries are shown as the tangible thing they leave;
   - some entries gain extra ways in: a 3-, 4- or 5-piece assembly, or working
     one resource with an action (`via`);
   - worked forms (Stick, Clay…) exist as held states, outside the counts;
   - depth is worked out again, since a shorter way in changes how deep
     everything downstream is.
   The base pairs stay unless the data retires one on purpose.
   ========================================================================== */

export const multiKey = (ids: readonly string[]) => [...ids].sort().join(' ');

const sameRec = (a: string[], b: string[]) => multiKey(a) === multiKey(b);

export function compile(data: ProcessingData): Processing {
  const byFrom = new Map<string, TransformDef[]>();
  const byOut = new Map<string, TransformDef[]>();
  for (const t of data.transforms) {
    if (!byFrom.has(t.from)) byFrom.set(t.from, []);
    byFrom.get(t.from)!.push(t);
    for (const o of t.out) {
      if (!byOut.has(o)) byOut.set(o, []);
      byOut.get(o)!.push(t);
    }
  }
  const capSet: Record<Capability, Set<string>> = Object.create(null);
  for (const [cap, ids] of Object.entries(data.capabilities)) capSet[cap] = new Set(ids);
  return { ...data, stateIds: new Set(data.states.map(s => s.id)), byFrom, byOut, capSet };
}

function makeState(s: StateDef): Discovery {
  return {
    id: s.id, no: 0, n: s.n, era: s.era, cat: s.cat ?? 'material', date: '', ds: 0, rar: 'common',
    l1: s.l1, l2: s.l2 ?? s.l1, l3: '', ev: '', src: [], rec: [], tags: s.tags ?? [], vis: s.vis ?? s.id,
    depth: null, need: 0, uses: [], state: true,
  };
}

/** Minimum crafting depth of everything, counting recipes, processing and world offers. */
export function computeDepths(nodes: Discovery[], proc: Processing, primitives: string[]): Map<string, number> {
  const depth = new Map<string, number>(primitives.map(p => [p, 0]));
  const capDepth = (cap: Capability) => {
    let best = Infinity;
    for (const id of proc.capSet[cap] ?? []) { const d = depth.get(id); if (d !== undefined && d < best) best = d; }
    return best;
  };
  const set = (id: string, v: number) => {
    const cur = depth.get(id);
    if (cur === undefined || v < cur) { depth.set(id, v); return true; }
    return false;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      for (const r of n.rec) {
        if (r.every(i => depth.has(i))) changed = set(n.id, Math.max(...r.map(i => depth.get(i)!)) + 1) || changed;
      }
    }
    for (const t of proc.transforms) {
      const d = depth.get(t.from);
      if (d === undefined) continue;
      let base = d;
      if (t.needs) { const c = capDepth(t.needs); if (!isFinite(c)) continue; base = Math.max(base, c); }
      for (const o of t.out) changed = set(o, base + 1) || changed;
    }
    for (const u of proc.unlocks) {
      const ds = u.when.map(w => depth.get(w));
      const ok = u.any ? ds.some(x => x !== undefined) : ds.every(x => x !== undefined);
      if (!ok) continue;
      const known = ds.filter((x): x is number => x !== undefined);
      changed = set(u.give, (u.any ? Math.min(...known) : Math.max(...known)) + 1) || changed;
    }
  }
  return depth;
}

export function applyProcessing(raw: Db, data: ProcessingData): Db {
  const proc = compile(data);
  const nodes: Discovery[] = raw.nodes.map(n => ({ ...n, rec: n.rec.map(r => r.slice()), via: undefined }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const states = data.states.map(makeState);
  const stateById = new Map(states.map(s => [s.id, s]));

  // 1 — tangible names
  for (const [id, o] of Object.entries(data.objectify)) {
    const n = byId.get(id);
    if (!n) throw new Error(`processing: objectify names unknown entry ${id}`);
    n.n = o.n;
    if (o.l1) n.l1 = o.l1;
  }

  // 2 — retired and added recipes
  for (const e of data.recipes.retire) {
    const n = byId.get(e.id);
    if (!n) throw new Error(`processing: retire names unknown entry ${e.id}`);
    const before = n.rec.length;
    n.rec = n.rec.filter(r => !sameRec(r, e.rec));
    if (n.rec.length === before) throw new Error(`processing: ${e.id} has no recipe ${e.rec.join('+')} to retire`);
  }
  for (const e of data.recipes.add) {
    const n = byId.get(e.id);
    if (!n) throw new Error(`processing: add names unknown entry ${e.id}`);
    if (e.rec.length < 2 || e.rec.length > 5) throw new Error(`processing: ${e.id} recipe must have 2–5 pieces`);
    for (const i of e.rec) if (!byId.has(i) && !stateById.has(i)) throw new Error(`processing: ${e.id} uses unknown ${i}`);
    if (!n.rec.some(r => sameRec(r, e.rec))) n.rec.push(e.rec.slice());
  }

  // 3 — ways of working one thing
  for (const t of data.transforms) {
    if (!byId.has(t.from) && !stateById.has(t.from)) throw new Error(`processing: transform from unknown ${t.from}`);
    for (const o of t.out) {
      const target = byId.get(o) ?? stateById.get(o);
      if (!target) throw new Error(`processing: transform yields unknown ${o}`);
      (target.via ??= []).push({ from: t.from, action: t.action });
    }
  }

  // 4 — depth, again
  const all = [...nodes, ...states];
  const depth = computeDepths(nodes, proc, raw.primitives);
  for (const n of all) {
    const d = depth.get(n.id);
    n.depth = d ?? n.depth;
  }

  // 5 — what each thing is an ingredient for, from what is now true
  const uses = new Map<string, Set<string>>();
  const use = (from: string, to: string) => { if (!uses.has(from)) uses.set(from, new Set()); uses.get(from)!.add(to); };
  for (const n of nodes) {
    n.rec.forEach(r => r.forEach(i => use(i, n.id)));
    n.via?.forEach(v => use(v.from, n.id));
  }
  for (const s of states) s.via?.forEach(v => use(v.from, s.id));
  for (const n of all) n.uses = [...(uses.get(n.id) ?? [])];

  return { ...raw, nodes, states, proc };
}
