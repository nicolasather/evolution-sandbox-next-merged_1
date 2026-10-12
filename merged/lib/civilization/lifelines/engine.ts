import { distribute, generateLayout } from './layout';
import { effectiveCapacity, linkOther, maxFlow, toLinkFlows } from './network';
import {
  ACTIVE_PER_DISTRICT, ALTERNATE_FROM_CHAPTER, CONDITION_DROP, CONDITION_FLOOR, CONDITION_MAX, CONDITION_RECOVER,
  EFFECT_FAMILIES, EFFORT_PER_SEASON, GATHER_AMOUNT, GATHER_RESOURCES, KNOWLEDGE_SUPPORT_FACTOR, LINK_BOOST,
  MATERIAL_SHORT_FACTOR, REFUND_FRACTION_MILLI, REPAIR_FRACTION_MILLI, REPAIR_FROM_CHAPTER, REPAIR_LINK_COST,
  REPAIR_MIN, ROUTING_FROM_CHAPTER, WAITING_PER_DISTRICT, districtAllows, eventEligible, quantitiesToMilli, toMilli,
  workRequiredFor,
} from './rules';
import {
  MILLI, RESOURCE_IDS, RULES_VERSION, RuleError, requireRule,
  type Command, type CommandWithGuard, type ContentIndex, type DistrictNeed, type DomainEvent, type EffectLine,
  type LedgerRow, type LifelinesState, type LinkFlow, type MilliQuantities, type QueueItem, type ReduceResult,
  type ResourceId, type RunMode, type SeasonReport, type Stocks, type Warning,
} from './schema';

/* ============================================================================
   LIFELINES ENGINE — pure, deterministic, framework-free.

   • Fixed-point: every stored quantity is an integer number of milli-units.
   • One pipeline: a committed season and the forecast both run advanceSeason.
     There is no second approximate implementation to drift.
   • One validation boundary: every command crosses reduce(), which validates
     the state, the revision guard and the command before anything changes.
   • No clock, no Math.random, no storage, no React.

   Season pipeline (documented completion boundary: a programme that completes
   in season N begins producing in season N+1):
     snapshot → supply/need per district → effect families → condition-scaled
     output → per-service flow (upkeep first, then demand, then reserve draw,
     then surplus to reserve) → ledger → maintenance condition → construction
     work and completions → objectives → event scheduling → persist (caller).
   ============================================================================ */

/** State is plain JSON (no Maps, no undefined), so a JSON round trip is an exact, environment-independent deep copy. */
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const zeroStocks = (): Stocks => Object.fromEntries(RESOURCE_IDS.map(r => [r, 0])) as Stocks;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const stockCapMilli = (index: ContentIndex): number => toMilli(index.db.rules.stockCap);
const mulFactor = (v: number, factorMilli: number) => Math.floor((v * factorMilli) / 1000);

/* ------------------------------- creation -------------------------------- */

export interface CreateRunOptions {
  variantId: string;
  /** Generated once on the client after hydration and then persisted. */
  runId: string;
  mode?: RunMode;
  masteryDeclared?: string[];
}

export function createRun(index: ContentIndex, opts: CreateRunOptions): LifelinesState {
  const v = index.variants.get(opts.variantId);
  requireRule(v && typeof opts.runId === 'string' && opts.runId.length > 0 && opts.runId.length <= 200, 'invalid-run');
  const chapter = index.chapters.get(v.chapterId);
  requireRule(chapter, 'invalid-run');
  const stocks = Object.fromEntries(RESOURCE_IDS.map(r => [r, toMilli(v.startingStock[r])])) as Stocks;
  return {
    schemaVersion: 2, engine: 'district', contentVersion: index.db.contentVersion, rulesVersion: RULES_VERSION,
    runId: opts.runId, revision: 0, mode: opts.mode ?? 'campaign', variantId: v.id, seed: v.seed,
    chapterId: v.chapterId, biomeId: v.biomeId, era: chapter.era, turn: 0, actionsLeft: index.db.rules.actionsPerTurn,
    stocks, seasonStartStocks: { ...stocks }, transfers: zeroStocks(),
    layout: generateLayout(v.seed, chapter, index),
    built: [], queue: [], policies: [], routingPriority: null,
    pendingEventId: null, pendingEventDistrictId: null, eventHistory: [], resolvedEvents: [], decisions: [],
    report: null, objectiveIds: [],
    completion: { status: 'active', completedAtTurn: null, completionKey: null },
    horizonReached: false,
    flags: { forecastViewed: false, firstProgrammeSeen: false, eventResolved: false },
    lastProgressTurn: 0, hintsUsed: 0, emergencyUsedTurn: null, emergencyCount: 0, nextQueueNumber: 1,
    policyGroupsUsed: [], alternateBuilt: false,
    masteryDeclared: [...(opts.masteryDeclared ?? [])].sort(),
    log: [{ turn: 0, text: `${chapter.title} begins.` }],
  };
}

/* ------------------------------- validation ------------------------------ */

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);

/** Returns null when the state is a valid simulation state, else a stable error code. A valid JSON object is not a valid state. */
export function validateRunState(index: ContentIndex, s: unknown): string | null {
  try {
    const st = s as LifelinesState;
    requireRule(st && typeof st === 'object' && st.schemaVersion === 2 && st.engine === 'district', 'invalid-version');
    requireRule(st.contentVersion === index.db.contentVersion, 'content-version-mismatch');
    requireRule(st.rulesVersion === RULES_VERSION, 'rules-version-mismatch');
    requireRule(typeof st.runId === 'string' && st.runId.length > 0 && st.runId.length <= 200, 'invalid-run-id');
    const v = index.variants.get(st.variantId);
    requireRule(v && v.chapterId === st.chapterId && v.biomeId === st.biomeId && v.seed === st.seed, 'invalid-identity');
    requireRule(index.chapters.get(st.chapterId)?.era === st.era, 'invalid-era');
    requireRule(st.mode === 'campaign' || st.mode === 'sandbox', 'invalid-mode');
    requireRule(isInt(st.revision) && st.revision >= 0, 'invalid-revision');
    requireRule(isInt(st.turn) && st.turn >= 0 && st.turn <= 1_000_000, 'invalid-turn');
    requireRule(isInt(st.actionsLeft) && st.actionsLeft >= 0 && st.actionsLeft <= index.db.rules.actionsPerTurn, 'invalid-actions');
    const cap = stockCapMilli(index);
    for (const r of RESOURCE_IDS) {
      requireRule(isInt(st.stocks?.[r]) && st.stocks[r] >= 0 && st.stocks[r] <= cap, 'invalid-stock');
      requireRule(isInt(st.seasonStartStocks?.[r]) && st.seasonStartStocks[r] >= 0 && st.seasonStartStocks[r] <= cap, 'invalid-season-start');
      requireRule(isInt(st.transfers?.[r]) && Math.abs(st.transfers[r]) <= cap * 100, 'invalid-transfers');
      requireRule(st.seasonStartStocks[r] + st.transfers[r] === st.stocks[r], 'transfers-do-not-balance');
    }
    const L = st.layout;
    requireRule(L && Array.isArray(L.districts) && L.districts.length >= 3 && L.districts.length <= 7, 'invalid-layout');
    const dIds = new Set(L.districts.map(d => d.id));
    requireRule(dIds.size === L.districts.length && L.districts.filter(d => d.storage).length === 1, 'invalid-layout');
    requireRule(Array.isArray(L.links) && L.links.length <= 60 && Array.isArray(L.potentialLinks) && L.potentialLinks.length <= 20, 'invalid-layout');
    const seen = new Set<string>();
    for (const l of L.links) {
      requireRule(dIds.has(l.a) && dIds.has(l.b) && l.a !== l.b && !seen.has(l.id), 'invalid-link');
      seen.add(l.id);
      requireRule(isInt(l.capacity) && l.capacity > 0 && l.capacity <= 100 * MILLI && isInt(l.condition) && l.condition >= 0 && l.condition <= 1000, 'invalid-link');
      requireRule(Array.isArray(l.supports) && l.supports.every(r => index.resources.has(r)), 'invalid-link');
    }
    const ids = new Set<string>();
    requireRule(Array.isArray(st.built) && st.built.length <= 200 && Array.isArray(st.queue) && st.queue.length <= 100, 'invalid-lists');
    for (const b of st.built) {
      requireRule(index.projects.has(b.projectId) && dIds.has(b.districtId) && !ids.has(b.projectId), 'invalid-built');
      ids.add(b.projectId);
      requireRule(isInt(b.condition) && b.condition >= CONDITION_FLOOR && b.condition <= CONDITION_MAX, 'invalid-condition');
      requireRule(index.projects.get(b.projectId)?.requires.every(x => st.built.some(o => o.projectId === x)), 'invalid-built');
    }
    for (const q of st.queue) {
      requireRule(index.projects.has(q.projectId) && dIds.has(q.districtId) && !ids.has(q.projectId), 'invalid-queue');
      ids.add(q.projectId);
      requireRule(q.status === 'active' || q.status === 'waiting', 'invalid-queue');
      requireRule(isInt(q.workRequired) && q.workRequired > 0 && isInt(q.workDone) && q.workDone >= 0 && q.workDone < q.workRequired, 'invalid-queue');
      for (const [r, n] of Object.entries(q.committed)) requireRule(index.resources.has(r) && isInt(n) && n >= 0, 'invalid-queue');
    }
    requireRule(new Set(st.queue.map(q => q.queueId)).size === st.queue.length, 'invalid-queue');
    requireRule(Array.isArray(st.policies) && st.policies.length <= index.db.rules.policySlots, 'invalid-policy-slots');
    const groups = new Set<string>();
    for (const p of st.policies) {
      const pol = index.policies.get(p.id);
      requireRule(pol && !groups.has(pol.exclusiveGroup) && (p.districtId === null || dIds.has(p.districtId)), 'invalid-policy-slots');
      groups.add(pol.exclusiveGroup);
    }
    requireRule(st.routingPriority === null || index.resources.has(st.routingPriority), 'invalid-routing');
    requireRule(st.pendingEventId === null || (index.events.has(st.pendingEventId) && st.pendingEventDistrictId !== null && dIds.has(st.pendingEventDistrictId)), 'invalid-event');
    requireRule(Array.isArray(st.eventHistory) && st.eventHistory.length <= 100 && st.eventHistory.every(e => index.events.has(e.id) && isInt(e.turn) && e.turn >= 0 && e.turn <= st.turn), 'invalid-event-history');
    requireRule(Array.isArray(st.resolvedEvents) && st.resolvedEvents.length <= 200 && st.resolvedEvents.every(e => index.events.has(e.eventId) && typeof e.choiceId === 'string' && isInt(e.revision)), 'invalid-event-log');
    requireRule(Array.isArray(st.decisions) && st.decisions.length <= 60, 'invalid-decisions');
    requireRule(Array.isArray(st.log) && st.log.length <= 80 && st.log.every(e => isInt(e.turn) && typeof e.text === 'string' && e.text.length < 1000), 'invalid-log');
    requireRule(st.objectiveIds.every(id => index.objectives.has(id)) && new Set(st.objectiveIds).size === st.objectiveIds.length, 'invalid-objectives');
    requireRule(['active', 'completed', 'archived'].includes(st.completion?.status), 'invalid-status');
    requireRule(st.completion.completedAtTurn === null || (isInt(st.completion.completedAtTurn) && st.completion.completedAtTurn <= st.turn), 'invalid-completion');
    requireRule(typeof st.flags?.forecastViewed === 'boolean' && isInt(st.hintsUsed) && st.hintsUsed >= 0 && isInt(st.nextQueueNumber), 'invalid-flags');
    requireRule(Array.isArray(st.policyGroupsUsed) && st.policyGroupsUsed.every(r => index.resources.has(r)), 'invalid-mastery');
    if (st.report) {
      requireRule(Array.isArray(st.report.ledger) && st.report.ledger.length === RESOURCE_IDS.length, 'invalid-report');
      for (const row of st.report.ledger) {
        requireRule(index.resources.has(row.resource), 'invalid-report');
        for (const k of ['start', 'effects', 'produced', 'stranded', 'overflow', 'demand', 'upkeep', 'unmetDemand', 'unmetUpkeep', 'direct', 'fromStore', 'toStore', 'end'] as const) {
          requireRule(isInt(row[k]) && row[k] >= 0, 'invalid-report');
        }
        requireRule(isInt(row.transfers), 'invalid-report');
      }
    }
    return null;
  } catch (e) {
    return e instanceof RuleError ? e.code : 'invalid-state';
  }
}

/* ------------------------------ ledger maths ----------------------------- */

/** Zero when the ledger row conserves: start + transfers + effects + produced − stranded − overflow − demand − upkeep + unmet = end. */
export function ledgerResidual(r: LedgerRow): number {
  return r.start + r.transfers + r.effects + r.produced - r.stranded - r.overflow - r.demand - r.upkeep
    + r.unmetDemand + r.unmetUpkeep - r.end;
}

/* ------------------------------ season pipeline -------------------------- */

type PerService<T> = Record<ResourceId, T>;
const perService = <T,>(make: () => T): PerService<T> => Object.fromEntries(RESOURCE_IDS.map(r => [r, make()])) as PerService<T>;
const sumMap = (m: ReadonlyMap<string, number>) => { let t = 0; for (const v of m.values()) t += v; return t; };
const addTo = (m: Map<string, number>, k: string, v: number) => { if (v) m.set(k, (m.get(k) ?? 0) + v); };

function knowledgeSupported(s: LifelinesState, index: ContentIndex, districtId: string): boolean {
  const hosts = new Set(s.built.filter(b => index.projects.get(b.projectId)?.sector === 'knowledge').map(b => b.districtId));
  if (hosts.has(districtId)) return true;
  return s.layout.links.some(l => l.supports.includes('knowledge') && l.condition > 0
    && (l.a === districtId || l.b === districtId) && hosts.has(linkOther(l, districtId)));
}

function queueOrder(a: QueueItem, b: QueueItem) { return a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0; }

function promoteWaiting(s: LifelinesState): void {
  for (const d of s.layout.districts) {
    const mine = s.queue.filter(q => q.districtId === d.id).sort(queueOrder);
    let active = mine.filter(q => q.status === 'active').length;
    for (const q of mine) if (q.status === 'waiting' && active < ACTIVE_PER_DISTRICT) { q.status = 'active'; active++; }
  }
}

function addLog(s: LifelinesState, text: string): void {
  s.log = [...s.log, { turn: s.turn, text }].slice(-80);
}

/** Resolve one committed season in place on `s`. The forecast calls this on a clone. */
function advanceSeason(index: ContentIndex, s: LifelinesState, events: DomainEvent[]): SeasonReport {
  const rules = index.db.rules;
  const biome = index.biomes.get(s.biomeId) as NonNullable<ReturnType<typeof index.biomes.get>>;
  const layout = s.layout;
  const ids = layout.districts.map(d => d.id);
  const store = layout.districts.find(d => d.storage) as (typeof layout.districts)[number];
  const cap = stockCapMilli(index);
  const mult = (r: ResourceId) => toMilli(biome.multipliers[r] ?? 1);

  const supply = perService(() => new Map<string, number>());
  const upkeepNeed = perService(() => new Map<string, number>());
  const demandNeed = perService(() => new Map<string, number>());
  const effects = zeroStocks();
  const effectLines: EffectLine[] = [];

  // Baseline production and population demand, split by district weights.
  for (const r of RESOURCE_IDS) {
    const base = mulFactor(toMilli(rules.baseOutput[r] ?? 0), mult(r));
    distribute(base, layout.districts.map(d => d.supplyWeights[r])).forEach((v, i) => addTo(supply[r], ids[i], v));
    const need = toMilli(rules.consumption[r] ?? 0);
    distribute(need, layout.districts.map(d => d.demandWeights[r])).forEach((v, i) => addTo(demandNeed[r], ids[i], v));
  }

  // Established programmes: condition-scaled output at their district; upkeep at full rate.
  for (const b of s.built) {
    const p = index.projects.get(b.projectId);
    if (!p) continue;
    for (const [r, n] of Object.entries(p.output) as [ResourceId, number][]) {
      addTo(supply[r], b.districtId, mulFactor(mulFactor(toMilli(n), mult(r)), b.condition));
    }
    for (const [r, n] of Object.entries(p.upkeep) as [ResourceId, number][]) addTo(upkeepNeed[r], b.districtId, toMilli(n));
  }

  // Policies: output and upkeep land on the chosen district, or spread by demand weight settlement-wide.
  for (const choice of s.policies) {
    const pol = index.policies.get(choice.id);
    if (!pol) continue;
    const place = (r: ResourceId, amount: number, into: Map<string, number>) => {
      if (choice.districtId) addTo(into, choice.districtId, amount);
      else distribute(amount, layout.districts.map(d => d.demandWeights[r])).forEach((v, i) => addTo(into, ids[i], v));
    };
    for (const [r, n] of Object.entries(pol.output) as [ResourceId, number][]) place(r, mulFactor(toMilli(n), mult(r)), supply[r]);
    for (const [r, n] of Object.entries(pol.upkeep) as [ResourceId, number][]) place(r, toMilli(n), upkeepNeed[r]);
  }

  // Effect family: repair — lowers OTHER programmes' recurring materials upkeep (waste less ≠ produce more).
  const repairIds = s.built.filter(b => EFFECT_FAMILIES[b.projectId]?.kind === 'repair');
  if (repairIds.length) {
    const eligible = new Map<string, number>();
    for (const b of s.built) {
      if (EFFECT_FAMILIES[b.projectId]?.kind === 'repair') continue;
      addTo(eligible, b.districtId, toMilli(index.projects.get(b.projectId)?.upkeep.materials ?? 0));
    }
    const eligibleTotal = sumMap(eligible);
    const share = Math.min(1000, repairIds.reduce((t, b) => t + ((EFFECT_FAMILIES[b.projectId] as { savedShareMilli: number }).savedShareMilli), 0));
    const saved = mulFactor(eligibleTotal, share);
    if (saved > 0) {
      let remaining = saved;
      for (const id of [...eligible.keys()].sort()) {
        const cut = Math.min(upkeepNeed.materials.get(id) ?? 0, mulFactor(eligible.get(id) as number, share), remaining);
        if (cut > 0) { upkeepNeed.materials.set(id, (upkeepNeed.materials.get(id) ?? 0) - cut); remaining -= cut; }
      }
      const actual = saved - remaining;
      if (actual > 0) effectLines.push({ label: 'Repair work lowers recurring materials upkeep', resource: 'materials', amount: actual });
    }
  }

  // Effect family: loop — a share (always < 1) of materials consumed returns to the reserve.
  const loopBuilt = s.built.filter(b => EFFECT_FAMILIES[b.projectId]?.kind === 'loop');
  if (loopBuilt.length) {
    const consumed = sumMap(upkeepNeed.materials) + sumMap(demandNeed.materials);
    const share = Math.min(900, loopBuilt.reduce((t, b) => t + ((EFFECT_FAMILIES[b.projectId] as { returnShareMilli: number }).returnShareMilli), 0));
    const credit = Math.min(mulFactor(consumed, share), Math.max(0, cap - s.stocks.materials));
    if (credit > 0) {
      effects.materials += credit;
      effectLines.push({ label: 'Returned materials (processing cost is the loop programme\'s energy upkeep)', resource: 'materials', amount: credit });
    }
  }

  // Link capacity: logistics/water/energy/knowledge programmes strengthen incident links that carry their service.
  const boost = new Map<string, number>();
  for (const b of s.built) {
    const sector = index.projects.get(b.projectId)?.sector;
    if (!sector) continue;
    for (const l of layout.links) {
      if ((l.a === b.districtId || l.b === b.districtId) && l.supports.includes(sector)) {
        addTo(boost, l.id, mulFactor(LINK_BOOST, b.condition));
      }
    }
  }
  const traffic = new Map<string, number>();

  const order: ResourceId[] = [
    ...(s.routingPriority ? [s.routingPriority] : []),
    ...RESOURCE_IDS.filter(r => r !== s.routingPriority),
  ];
  const ledger = new Map<ResourceId, LedgerRow>();
  const needs: DistrictNeed[] = [];
  const flows: LinkFlow[] = [];
  const warnings: Warning[] = [];
  const upkeepSatisfiedRatio = new Map<string, number>(); // `${district}|${resource}` → milli ratio

  for (const r of order) {
    const arcsFor = () => layout.links.filter(l => l.supports.includes(r)).map(l => ({
      linkId: l.id, from: l.a, to: l.b, directed: l.directed,
      cap: Math.max(0, effectiveCapacity(l, boost.get(l.id) ?? 0) - (traffic.get(l.id) ?? 0)),
    }));
    const netTotal = new Map<string, number>();
    const run = (sources: Map<string, number>, sinks: Map<string, number>) => {
      const res = maxFlow(ids, arcsFor(), sources, sinks);
      for (const [lid, f] of res.net) { traffic.set(lid, (traffic.get(lid) ?? 0) + Math.abs(f)); netTotal.set(lid, (netTotal.get(lid) ?? 0) + f); }
      return res;
    };
    const remainingSupply = new Map(supply[r]);
    const upkeepLeft = new Map(upkeepNeed[r]);
    const demandLeft = new Map(demandNeed[r]);
    const consume = (res: ReturnType<typeof run>, pool: Map<string, number>, from: Map<string, number> | null) => {
      for (const [id, v] of res.absorbed) pool.set(id, (pool.get(id) ?? 0) - v);
      if (from) for (const [id, v] of res.drawn) from.set(id, (from.get(id) ?? 0) - v);
    };

    const startStock = s.stocks[r];
    const effectCredit = effects[r];
    const s0 = startStock + effectCredit;
    const upkeepSat = new Map<string, number>(), demandSat = new Map<string, number>();

    const a = run(remainingSupply, upkeepLeft); consume(a, upkeepLeft, remainingSupply);
    for (const [id, v] of a.absorbed) addTo(upkeepSat, id, v);
    const b2 = run(remainingSupply, demandLeft); consume(b2, demandLeft, remainingSupply);
    for (const [id, v] of b2.absorbed) addTo(demandSat, id, v);
    const direct = a.total + b2.total;

    const storeStock = new Map<string, number>([[store.id, s0]]);
    const c = run(storeStock, upkeepLeft); consume(c, upkeepLeft, storeStock);
    for (const [id, v] of c.absorbed) addTo(upkeepSat, id, v);
    const d = run(storeStock, demandLeft); consume(d, demandLeft, storeStock);
    for (const [id, v] of d.absorbed) addTo(demandSat, id, v);
    const fromStore = c.total + d.total;

    const surplusTotal = sumMap(remainingSupply);
    const e = run(remainingSupply, new Map([[store.id, Number.MAX_SAFE_INTEGER]]));
    const reached = e.total;
    const room = Math.max(0, cap - (s0 - fromStore));
    const toStore = Math.min(reached, room);
    const overflow = reached - toStore;
    const stranded = surplusTotal - reached;
    const end = s0 - fromStore + toStore;

    const unmetDemand = sumMap(demandLeft), unmetUpkeep = sumMap(upkeepLeft);
    ledger.set(r, {
      resource: r, start: s.seasonStartStocks[r], transfers: s.transfers[r], effects: effectCredit,
      produced: sumMap(supply[r]), stranded, overflow, demand: sumMap(demandNeed[r]), upkeep: sumMap(upkeepNeed[r]),
      unmetDemand, unmetUpkeep, direct, fromStore, toStore, end,
    });
    for (const id of ids) {
      const ud = upkeepLeft.get(id) ?? 0, dd = demandLeft.get(id) ?? 0;
      if (ud > 0 || dd > 0) needs.push({ districtId: id, resource: r, unmet: dd, upkeepUnmet: ud });
      const need = upkeepNeed[r].get(id) ?? 0;
      if (need > 0) upkeepSatisfiedRatio.set(`${id}|${r}`, Math.floor(((need - ud) * 1000) / need));
    }
    flows.push(...toLinkFlows(layout, r, netTotal));

    if (unmetDemand + unmetUpkeep > 0) {
      const leftover = stranded > 0 || s0 - fromStore > 0;
      let bottleneckLinkId: string | null = null;
      if (leftover) {
        const worst = layout.links.filter(l => l.supports.includes(r) && effectiveCapacity(l, boost.get(l.id) ?? 0) - (traffic.get(l.id) ?? 0) <= 0 && (traffic.get(l.id) ?? 0) > 0);
        bottleneckLinkId = worst.sort((x, y) => (x.id < y.id ? -1 : 1))[0]?.id ?? null;
      }
      warnings.push({
        resource: r, deficit: unmetDemand + unmetUpkeep, cause: leftover ? 'network' : 'supply', bottleneckLinkId,
        districts: ids.map(id => ({ districtId: id, unmet: (demandLeft.get(id) ?? 0) + (upkeepLeft.get(id) ?? 0) })).filter(x => x.unmet > 0),
      });
    }
    s.stocks[r] = end;
  }
  const orderedLedger = RESOURCE_IDS.map(r => ledger.get(r) as LedgerRow);
  warnings.sort((x, y) => RESOURCE_IDS.indexOf(x.resource) - RESOURCE_IDS.indexOf(y.resource));

  // Maintenance: condition moves only with explicit unmet upkeep; never below the floor, never deleted.
  for (const b of s.built) {
    const p = index.projects.get(b.projectId);
    if (!p) continue;
    let shortfall = 0;
    for (const r of Object.keys(p.upkeep) as ResourceId[]) {
      const ratio = upkeepSatisfiedRatio.get(`${b.districtId}|${r}`) ?? 1000;
      shortfall = Math.max(shortfall, 1000 - ratio);
    }
    b.condition = shortfall > 0
      ? Math.max(CONDITION_FLOOR, b.condition - Math.floor((CONDITION_DROP * shortfall) / 1000))
      : Math.min(CONDITION_MAX, b.condition + CONDITION_RECOVER);
  }

  // Construction: each active item gets its district's effort; completions begin producing NEXT season.
  const work: SeasonReport['work'] = [];
  const completed: SeasonReport['completed'] = [];
  const materialsShort = new Set(needs.filter(n => n.resource === 'materials' && n.unmet + n.upkeepUnmet > 0).map(n => n.districtId));
  const nextTurn = s.turn + 1;
  for (const q of [...s.queue].sort(queueOrder)) {
    if (q.status !== 'active') continue;
    let factor = 1000;
    if (knowledgeSupported(s, index, q.districtId)) factor = mulFactor(factor, KNOWLEDGE_SUPPORT_FACTOR);
    if (materialsShort.has(q.districtId)) factor = mulFactor(factor, MATERIAL_SHORT_FACTOR);
    const effort = mulFactor(EFFORT_PER_SEASON, factor);
    q.workDone = Math.min(q.workRequired, q.workDone + effort);
    if (q.firstWorkTurn === null) q.firstWorkTurn = s.turn;
    work.push({ queueId: q.queueId, effort, remaining: q.workRequired - q.workDone });
    if (q.workDone >= q.workRequired) {
      q.status = 'completed';
      s.built.push({
        instanceId: `i-${q.queueId}`, projectId: q.projectId, districtId: q.districtId, condition: CONDITION_MAX,
        completedTurn: nextTurn, queueId: q.queueId, committedMaterials: q.committed.materials ?? 0,
      });
      completed.push({ queueId: q.queueId, projectId: q.projectId, districtId: q.districtId });
      events.push({ type: 'programme-completed', queueId: q.queueId, projectId: q.projectId, districtId: q.districtId });
      s.lastProgressTurn = nextTurn;
      addLog(s, `${index.projects.get(q.projectId)?.name ?? q.projectId} is established and begins producing next season.`);
    }
  }
  s.queue = s.queue.filter(q => q.status !== 'completed');
  promoteWaiting(s);

  // Record which service groups policies exercised (mastery), then roll the clock.
  for (const choice of s.policies) {
    const g = index.policies.get(choice.id)?.exclusiveGroup;
    if (g && !s.policyGroupsUsed.includes(g)) s.policyGroupsUsed = [...s.policyGroupsUsed, g].sort();
  }
  s.turn = nextTurn;
  s.actionsLeft = rules.actionsPerTurn;
  s.seasonStartStocks = { ...s.stocks };
  s.transfers = zeroStocks();

  if (warnings.length) addLog(s, 'A service reserve is short. Open the forecast to see where and why.');
  if (!s.horizonReached && s.turn >= (index.variants.get(s.variantId)?.maxTurns ?? Infinity)) {
    s.horizonReached = true;
    addLog(s, 'Planning horizon reached. This is a review point; nothing is lost and you may keep playing.');
    events.push({ type: 'horizon-reached', turn: s.turn });
  }

  // Seeded event: every fourth season, only when something sensible is eligible.
  if (!s.pendingEventId && s.turn % rules.eventEvery === 0 && (s.flags.forecastViewed || s.turn >= rules.eventEvery * 2)) {
    const eligible = index.db.events.filter(ev =>
      eventEligible(ev.id, s, index) && !s.eventHistory.some(h => h.id === ev.id && s.turn - h.turn < ev.cooldown));
    if (eligible.length) {
      const ev = eligible[hash(`${s.seed}:${s.turn}`) % eligible.length];
      const district = [...layout.districts].sort((x, y) => y.demandWeights[ev.sector] - x.demandWeights[ev.sector] || (x.id < y.id ? -1 : 1))[0];
      s.pendingEventId = ev.id;
      s.pendingEventDistrictId = district.id;
      s.eventHistory = [...s.eventHistory, { id: ev.id, turn: s.turn }].slice(-100);
      events.push({ type: 'event-scheduled', eventId: ev.id, districtId: district.id });
    }
  }
  events.push({ type: 'season-advanced', turn: s.turn });
  return { turn: s.turn, ledger: orderedLedger, effectLines, needs, flows, warnings, completed, work };
}

/* ------------------------------- objectives ------------------------------ */

function reevaluate(index: ContentIndex, s: LifelinesState, events: DomainEvent[]): void {
  const chapter = index.chapters.get(s.chapterId);
  if (!chapter) return;
  const before = s.objectiveIds.length;
  s.objectiveIds = chapter.objectiveIds.filter(id => {
    const o = index.objectives.get(id);
    if (!o) return false;
    if (o.kind === 'build') return s.built.some(b => b.projectId === o.projectId);
    if (o.kind === 'stock') return s.stocks[o.resource] >= toMilli(o.target);
    return s.turn >= o.target;
  });
  if (s.objectiveIds.length > before) s.lastProgressTurn = s.turn;
  if (s.completion.status === 'active' && s.objectiveIds.length === chapter.objectiveIds.length) {
    const key = `${chapter.id}@${RULES_VERSION}`;
    s.completion = { status: 'completed', completedAtTurn: s.turn, completionKey: key };
    s.lastProgressTurn = s.turn;
    addLog(s, 'Chapter goals met. Continue tending the settlement, or archive this attempt.');
    events.push({ type: 'chapter-completed', chapterId: chapter.id, completionKey: key, turn: s.turn, mode: s.mode });
  }
}

/* ------------------------------- commands -------------------------------- */

const pay = (s: LifelinesState, costs: MilliQuantities) => {
  for (const [r, n] of Object.entries(costs) as [ResourceId, number][]) { s.stocks[r] -= n; s.transfers[r] -= n; }
};
const refund = (s: LifelinesState, cap: number, amounts: MilliQuantities) => {
  for (const [r, n] of Object.entries(amounts) as [ResourceId, number][]) {
    const applied = Math.min(n, cap - s.stocks[r]);
    s.stocks[r] += applied; s.transfers[r] += applied;
  }
};
const affordable = (s: LifelinesState, costs: MilliQuantities) =>
  (Object.entries(costs) as [ResourceId, number][]).every(([r, n]) => s.stocks[r] >= n);

function taught(index: ContentIndex, s: LifelinesState, fromChapter: number): boolean {
  return s.mode === 'sandbox' || (index.chapters.get(s.chapterId)?.order ?? 0) >= fromChapter;
}

export function repairProgrammeCost(committedMaterials: number): MilliQuantities {
  return { materials: Math.max(REPAIR_MIN, mulFactor(committedMaterials, REPAIR_FRACTION_MILLI)) };
}

/** Why a programme cannot be started in a district right now, or null when it can. Shared by the UI and the reducer. */
export function queueBlockReason(index: ContentIndex, s: LifelinesState, projectId: string, districtId: string | null): string | null {
  const p = index.projects.get(projectId);
  if (!p) return 'unknown-project';
  if (s.completion.status === 'archived') return 'run-archived';
  if (s.pendingEventId) return 'resolve-event-first';
  if (s.built.some(b => b.projectId === p.id)) return 'already-established';
  if (s.queue.some(q => q.projectId === p.id)) return 'already-queued';
  if (p.era > s.era) return 'era-locked';
  if (!p.requires.every(id => s.built.some(b => b.projectId === id))) return 'missing-prerequisite';
  if (s.actionsLeft < 1) return 'no-actions';
  if (!affordable(s, quantitiesToMilli(p.cost))) return 'insufficient-stock';
  if (districtId !== null) {
    const d = s.layout.districts.find(x => x.id === districtId);
    if (!d) return 'unknown-district';
    if (!districtAllows(d.terrain, p.sector)) return 'terrain-unsuitable';
    if (s.queue.filter(q => q.districtId === districtId).length >= ACTIVE_PER_DISTRICT + WAITING_PER_DISTRICT) return 'district-queue-full';
  } else if (!s.layout.districts.some(d => districtAllows(d.terrain, p.sector))) return 'terrain-unsuitable';
  return null;
}

function applyCommand(index: ContentIndex, s: LifelinesState, cmd: Command, events: DomainEvent[]): boolean {
  const cap = stockCapMilli(index);
  requireRule(s.completion.status !== 'archived', 'run-archived');
  requireRule(!s.pendingEventId || cmd.type === 'resolve-event' || cmd.type === 'note-hint' || cmd.type === 'ack-forecast' || cmd.type === 'archive', 'resolve-event-first');
  switch (cmd.type) {
    case 'queue-programme': {
      const reason = queueBlockReason(index, s, cmd.projectId, cmd.districtId);
      requireRule(!reason, reason ?? '');
      const p = index.projects.get(cmd.projectId) as NonNullable<ReturnType<typeof index.projects.get>>;
      const committed = quantitiesToMilli(p.cost);
      pay(s, committed);
      const activeHere = s.queue.filter(q => q.districtId === cmd.districtId && q.status === 'active').length;
      const queueId = `q${s.nextQueueNumber++}`;
      s.queue.push({
        queueId, projectId: p.id, districtId: cmd.districtId, committed, workRequired: workRequiredFor(p), workDone: 0,
        startTurn: s.turn, firstWorkTurn: null, status: activeHere < ACTIVE_PER_DISTRICT ? 'active' : 'waiting',
      });
      s.actionsLeft--;
      s.flags.firstProgrammeSeen = true;
      addLog(s, `${p.name} planned. Costs reserved once.`);
      events.push({ type: 'programme-queued', queueId, projectId: p.id, districtId: cmd.districtId });
      return true;
    }
    case 'cancel-queue': {
      const q = s.queue.find(x => x.queueId === cmd.queueId);
      requireRule(q, 'unknown-queue-item');
      let back: MilliQuantities;
      if (q.workDone === 0) {
        back = { ...q.committed };
        // Same planning phase: the reserved action returns too.
        if (q.startTurn === s.turn) s.actionsLeft = Math.min(index.db.rules.actionsPerTurn, s.actionsLeft + 1);
      } else {
        // After work began: a documented share of UNSPENT materials only; knowledge and labour are never refunded.
        const mats = q.committed.materials ?? 0;
        back = { materials: Math.floor((mats * (q.workRequired - q.workDone) * REFUND_FRACTION_MILLI) / (q.workRequired * 1000)) };
      }
      refund(s, cap, back);
      s.queue = s.queue.filter(x => x.queueId !== q.queueId);
      promoteWaiting(s);
      addLog(s, `${index.projects.get(q.projectId)?.name ?? q.projectId} cancelled.`);
      events.push({ type: 'programme-cancelled', queueId: q.queueId, refunded: back });
      return true;
    }
    case 'set-policies': {
      const list = cmd.policies;
      requireRule(Array.isArray(list) && list.length <= index.db.rules.policySlots, 'invalid-policy-selection');
      requireRule(new Set(list.map(p => p.id)).size === list.length, 'invalid-policy-selection');
      const defs = list.map(p => index.policies.get(p.id));
      requireRule(defs.every(Boolean), 'unknown-policy');
      requireRule(new Set(defs.map(d => d?.exclusiveGroup)).size === defs.length, 'policy-conflict');
      requireRule(list.every(p => p.districtId === null || s.layout.districts.some(d => d.id === p.districtId)), 'unknown-district');
      const next = [...list].sort((a, b) => (a.id < b.id ? -1 : 1)).map(p => ({ id: p.id, districtId: p.districtId }));
      if (JSON.stringify(next) === JSON.stringify(s.policies)) return false; // unchanged: no log spam, no revision
      s.policies = next;
      s.decisions = [...s.decisions, { kind: 'policies' as const, turn: s.turn, revision: s.revision + 1, ids: next.map(p => p.id) }].slice(-60);
      addLog(s, 'Council decision recorded; it takes effect when the season is committed.');
      return true;
    }
    case 'set-routing': {
      requireRule(taught(index, s, ROUTING_FROM_CHAPTER), 'not-available-yet');
      requireRule(cmd.service === null || index.resources.has(cmd.service), 'unknown-resource');
      if (cmd.service === s.routingPriority) return false;
      s.routingPriority = cmd.service;
      s.decisions = [...s.decisions, { kind: 'routing' as const, turn: s.turn, revision: s.revision + 1, ids: cmd.service ? [cmd.service] : [] }].slice(-60);
      return true;
    }
    case 'gather': {
      requireRule((GATHER_RESOURCES as readonly string[]).includes(cmd.resource), 'invalid-gather');
      requireRule(s.actionsLeft > 0, 'no-actions');
      requireRule(s.emergencyUsedTurn !== s.turn, 'emergency-already-used');
      const applied = Math.min(GATHER_AMOUNT, cap - s.stocks[cmd.resource]);
      s.stocks[cmd.resource] += applied; s.transfers[cmd.resource] += applied;
      s.actionsLeft--; s.emergencyUsedTurn = s.turn; s.emergencyCount++;
      addLog(s, `Emergency shared work added ${cmd.resource}.`);
      return true;
    }
    case 'repair-link': {
      requireRule(taught(index, s, REPAIR_FROM_CHAPTER), 'not-available-yet');
      const l = s.layout.links.find(x => x.id === cmd.linkId);
      requireRule(l, 'unknown-link');
      requireRule(l.condition < 1000, 'link-in-good-condition');
      requireRule(s.actionsLeft > 0, 'no-actions');
      requireRule(affordable(s, REPAIR_LINK_COST), 'insufficient-stock');
      pay(s, REPAIR_LINK_COST); l.condition = 1000; s.actionsLeft--;
      addLog(s, 'A connection was repaired.');
      events.push({ type: 'link-repaired', linkId: l.id });
      return true;
    }
    case 'build-link': {
      requireRule(taught(index, s, ALTERNATE_FROM_CHAPTER), 'not-available-yet');
      const pl = s.layout.potentialLinks.find(x => x.id === cmd.potentialLinkId);
      requireRule(pl, 'unknown-link');
      const key = `${pl.type}|${[pl.a, pl.b].sort().join('|')}`;
      requireRule(!s.layout.links.some(l => `${l.type}|${[l.a, l.b].sort().join('|')}` === key), 'duplicate-connection');
      requireRule(s.actionsLeft > 0, 'no-actions');
      requireRule(affordable(s, pl.cost), 'insufficient-stock');
      pay(s, pl.cost); s.actionsLeft--;
      s.layout.links.push({ id: pl.id, type: pl.type, a: pl.a, b: pl.b, directed: false, capacity: pl.capacity, condition: 1000, supports: [...pl.supports] });
      s.alternateBuilt = true;
      addLog(s, 'A second route was established.');
      events.push({ type: 'link-built', linkId: pl.id });
      return true;
    }
    case 'repair-programme': {
      const b = s.built.find(x => x.instanceId === cmd.instanceId);
      requireRule(b, 'unknown-programme');
      requireRule(b.condition < CONDITION_MAX, 'programme-in-good-condition');
      const cost = repairProgrammeCost(b.committedMaterials);
      requireRule(s.actionsLeft > 0, 'no-actions');
      requireRule(affordable(s, cost), 'insufficient-stock');
      pay(s, cost); b.condition = CONDITION_MAX; s.actionsLeft--;
      addLog(s, `${index.projects.get(b.projectId)?.name ?? b.projectId} repaired.`);
      return true;
    }
    case 'resolve-event': {
      requireRule(s.pendingEventId, 'no-event');
      const e = index.events.get(s.pendingEventId) as NonNullable<ReturnType<typeof index.events.get>>;
      const choice = e.choices.find(c => c.id === cmd.choiceId);
      requireRule(choice, 'unknown-choice');
      const cost = quantitiesToMilli(choice.cost);
      requireRule(affordable(s, cost), 'insufficient-stock');
      pay(s, cost);
      for (const [r, n] of Object.entries(choice.delta) as [ResourceId, number][]) {
        const after = clamp(s.stocks[r] + toMilli(n), 0, cap);
        s.transfers[r] += after - s.stocks[r]; s.stocks[r] = after;
      }
      s.resolvedEvents = [...s.resolvedEvents, {
        eventId: e.id, choiceId: choice.id, turn: s.turn, revision: s.revision + 1, districtId: s.pendingEventDistrictId ?? '',
      }].slice(-200);
      s.pendingEventId = null; s.pendingEventDistrictId = null; s.flags.eventResolved = true;
      addLog(s, `${e.title}: ${choice.label}.`);
      events.push({ type: 'event-resolved', eventId: e.id, choiceId: choice.id });
      return true;
    }
    case 'ack-forecast':
      if (s.flags.forecastViewed) return false;
      s.flags.forecastViewed = true; return true;
    case 'note-hint':
      s.hintsUsed = Math.min(100000, s.hintsUsed + 1); return true;
    case 'advance': {
      const prior = s.report?.warnings ?? [];
      const report = advanceSeason(index, s, events);
      s.report = report;
      for (const w of report.warnings) {
        if (!prior.some(p => p.resource === w.resource)) events.push({ type: 'pressure-new', resource: w.resource, cause: w.cause });
      }
      for (const p of prior) if (!report.warnings.some(w => w.resource === p.resource)) events.push({ type: 'pressure-cleared', resource: p.resource });
      return true;
    }
    case 'archive':
      s.completion = { ...s.completion, status: 'archived' };
      events.push({ type: 'run-archived', runId: s.runId, chapterId: s.chapterId, turn: s.turn });
      return true;
    default:
      throw new RuleError('unknown-action');
  }
}

/** THE validation boundary: every state change goes through here. Pure; never mutates its input. */
export function reduce(index: ContentIndex, input: LifelinesState, command: CommandWithGuard): ReduceResult {
  const bad = validateRunState(index, input);
  requireRule(!bad, 'invalid-state');
  requireRule(command && typeof command.type === 'string', 'invalid-action');
  if (command.expectedRevision !== undefined) requireRule(command.expectedRevision === input.revision, 'revision-conflict');
  const s = clone(input);
  const events: DomainEvent[] = [];
  const changed = applyCommand(index, s, command, events);
  if (!changed) return { state: s, events };
  s.revision++;
  reevaluate(index, s, events);
  return { state: s, events };
}

/* -------------------------- forecast and previews ------------------------ */

/** What committing the season would do — computed by the SAME pipeline, on a clone. */
export function forecast(index: ContentIndex, input: LifelinesState): SeasonReport {
  requireRule(!validateRunState(index, input), 'invalid-state');
  const s = clone(input);
  return advanceSeason(index, s, []);
}

/** Run the pipeline forward `seasons` times with no further commands (events are not resolved; they never block a projection). */
export function project(index: ContentIndex, input: LifelinesState, seasons: number): SeasonReport[] {
  const s = clone(input);
  const out: SeasonReport[] = [];
  for (let i = 0; i < seasons; i++) { s.pendingEventId = null; s.pendingEventDistrictId = null; out.push(advanceSeason(index, s, [])); }
  return out;
}

/** Seasons until each queued item completes, using the real pipeline (capacity included), capped at `limit`. */
export function queueEtas(index: ContentIndex, input: LifelinesState, limit = 8): Map<string, number | null> {
  const etas = new Map<string, number | null>(input.queue.map(q => [q.queueId, null]));
  const s = clone(input);
  for (let i = 1; i <= limit; i++) {
    s.pendingEventId = null; s.pendingEventDistrictId = null;
    const r = advanceSeason(index, s, []);
    for (const c of r.completed) if (etas.get(c.queueId) === null) etas.set(c.queueId, i);
    if ([...etas.values()].every(v => v !== null)) break;
  }
  return etas;
}

/** The same state with a hypothetical command applied, or null when that command is not legal. Read-only. */
export function tryCommand(index: ContentIndex, input: LifelinesState, command: Command): LifelinesState | null {
  try { return reduce(index, input, command).state; } catch { return null; }
}

/** Changed-resource comparison of two forecasts (for the council preview and remedy comparison). */
export interface ReportDiff {
  changed: { resource: ResourceId; before: number; after: number }[];
  newShortages: ResourceId[];
  clearedShortages: ResourceId[];
  districts: { districtId: string; resource: ResourceId; before: number; after: number }[];
}
export function diffReports(before: SeasonReport, after: SeasonReport): ReportDiff {
  const changed = RESOURCE_IDS.flatMap(r => {
    const a = before.ledger.find(l => l.resource === r), b = after.ledger.find(l => l.resource === r);
    return a && b && a.end !== b.end ? [{ resource: r, before: a.end, after: b.end }] : [];
  });
  const had = new Set(before.warnings.map(w => w.resource)), has = new Set(after.warnings.map(w => w.resource));
  const key = (n: DistrictNeed) => `${n.districtId}|${n.resource}`;
  const bm = new Map(before.needs.map(n => [key(n), n.unmet + n.upkeepUnmet])), am = new Map(after.needs.map(n => [key(n), n.unmet + n.upkeepUnmet]));
  const districts: ReportDiff['districts'] = [];
  for (const k of new Set([...bm.keys(), ...am.keys()])) {
    const [districtId, resource] = k.split('|');
    const b = bm.get(k) ?? 0, a = am.get(k) ?? 0;
    if (a !== b) districts.push({ districtId, resource: resource as ResourceId, before: b, after: a });
  }
  return {
    changed,
    newShortages: [...has].filter(r => !had.has(r)),
    clearedShortages: [...had].filter(r => !has.has(r)),
    districts,
  };
}

/** The forecast the day after a programme would be established — how a programme will change the ledger once it produces. */
export function forecastWithProgramme(index: ContentIndex, input: LifelinesState, projectId: string, districtId: string): SeasonReport | null {
  const p = index.projects.get(projectId);
  if (!p || !input.layout.districts.some(d => d.id === districtId)) return null;
  const s = clone(input);
  s.built.push({ instanceId: 'preview', projectId, districtId, condition: CONDITION_MAX, completedTurn: s.turn, queueId: 'preview', committedMaterials: 0 });
  return advanceSeason(index, s, []);
}
