import {
  RESOURCE_IDS, type Biome, type Chapter, type ContentDatabase, type ContentIndex, type Era, type Hint,
  type Objective, type PressureEvent, type Policy, type Project, type ResourceRow, type Variant,
} from './schema';

/* ============================================================================
   LIFELINES CONTENT — the ONE loader and validator for
   data/civilization/lifelines.v1.json.

   • Lazy: the JSON is fetched by a dynamic import the first time Civilization
     needs it, as its own chunk. Main Evolution never downloads it.
   • Validated: nothing reaches the engine through a bare cast. Every id,
     reference and quantity is checked; a failure names the offending id so a
     developer can act on it (ContentError.code / .id).
   • Indexed once and memoized; the result is deeply frozen so a view can never
     mutate a content row.
   Authoring source: tools/build_lifelines_content.py (the JSON is generated).
   ========================================================================== */

export class ContentError extends Error {
  readonly code: string;
  readonly id: string | null;
  constructor(code: string, id: string | null = null) {
    super(id ? `${code}: ${id}` : code);
    this.name = 'ContentError';
    this.code = code;
    this.id = id;
  }
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const RESOURCE_SET: ReadonlySet<string> = new Set(RESOURCE_IDS);

function need(ok: unknown, code: string, id: string | null = null): asserts ok {
  if (!ok) throw new ContentError(code, id);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}

function checkQuantities(q: unknown, code: string, id: string, allowNegative = false): void {
  need(isObj(q), code, id);
  for (const [r, n] of Object.entries(q)) {
    need(RESOURCE_SET.has(r) && finite(n) && (allowNegative || n >= 0), code, id);
  }
}

function indexRows<T extends { id: string }>(rows: unknown, name: string): Map<string, T> {
  need(Array.isArray(rows), `missing-${name}`);
  const map = new Map<string, T>();
  for (const row of rows as T[]) {
    need(isObj(row) && typeof row.id === 'string' && row.id.length > 0, `invalid-${name}-row`);
    need(!map.has(row.id), `duplicate-${name}-id`, row.id);
    map.set(row.id, row);
  }
  return map;
}

/** Validate raw JSON and build the frozen index. Throws ContentError on any inconsistency. */
export function buildContentIndex(raw: unknown): ContentIndex {
  need(isObj(raw) && raw.schemaVersion === 1, 'unsupported-content-schema');
  need(typeof raw.contentVersion === 'string' && raw.contentVersion.length > 0, 'missing-content-version');
  const db = raw as unknown as ContentDatabase;
  need(isObj(db.rules) && db.rules.shortageMode === 'warnings-only', 'invalid-rules');
  need(Number.isInteger(db.rules.actionsPerTurn) && db.rules.actionsPerTurn > 0, 'invalid-rules');
  need(Number.isInteger(db.rules.policySlots) && db.rules.policySlots > 0, 'invalid-rules');
  need(finite(db.rules.stockCap) && db.rules.stockCap > 0, 'invalid-rules');
  need(Number.isInteger(db.rules.eventEvery) && db.rules.eventEvery > 0, 'invalid-rules');
  checkQuantities(db.rules.baseOutput, 'invalid-rules', 'baseOutput');
  checkQuantities(db.rules.consumption, 'invalid-rules', 'consumption');

  const resources = indexRows<ResourceRow>(db.resources, 'resources');
  need(resources.size === RESOURCE_IDS.length && RESOURCE_IDS.every(r => resources.has(r)), 'unexpected-resource-set');
  const projects = indexRows<Project>(db.projects, 'projects');
  const policies = indexRows<Policy>(db.policies, 'policies');
  const events = indexRows<PressureEvent>(db.events, 'events');
  const chapters = indexRows<Chapter>(db.chapters, 'chapters');
  const biomes = indexRows<Biome>(db.biomes, 'biomes');
  const variants = indexRows<Variant>(db.variants, 'variants');
  const objectives = indexRows<Objective>(db.objectives, 'objectives');
  indexRows<Hint>(db.hints, 'hints');
  need(Array.isArray(db.eras), 'missing-eras');
  const eras = new Map<number, Era>();
  for (const e of db.eras) { need(Number.isInteger(e.index) && !eras.has(e.index), 'invalid-era', e.id); eras.set(e.index, e); }

  for (const b of biomes.values()) checkQuantities(b.multipliers, 'invalid-biome-multiplier', b.id);
  for (const p of projects.values()) {
    need(resources.has(p.sector), 'unknown-sector', p.id);
    need(eras.has(p.era), 'unknown-era', p.id);
    need(Array.isArray(p.requires), 'invalid-prerequisites', p.id);
    for (const id of p.requires) {
      need(projects.has(id), 'unknown-prerequisite', `${p.id} -> ${id}`);
      need((projects.get(id) as Project).era <= p.era, 'prerequisite-later-era', `${p.id} -> ${id}`);
    }
    for (const field of ['cost', 'output', 'upkeep'] as const) checkQuantities(p[field], 'invalid-project-quantity', p.id);
    need(p.maxCopies === 1, 'unsupported-copy-limit', p.id);
  }
  // Prerequisites must be acyclic — iterative DFS, three colours.
  const colour = new Map<string, 1 | 2>();
  for (const root of projects.keys()) {
    const stack: { id: string; i: number }[] = [{ id: root, i: 0 }];
    if (colour.get(root) === 2) continue;
    colour.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const reqs = (projects.get(top.id) as Project).requires;
      if (top.i < reqs.length) {
        const next = reqs[top.i++];
        need(colour.get(next) !== 1, 'cyclic-prerequisite', next);
        if (!colour.has(next)) { colour.set(next, 1); stack.push({ id: next, i: 0 }); }
      } else { colour.set(top.id, 2); stack.pop(); }
    }
  }
  for (const p of policies.values()) {
    need(resources.has(p.sector) && resources.has(p.exclusiveGroup), 'invalid-policy', p.id);
    checkQuantities(p.output, 'invalid-policy-quantity', p.id);
    checkQuantities(p.upkeep, 'invalid-policy-quantity', p.id);
  }
  for (const e of events.values()) {
    need(resources.has(e.sector) && Number.isInteger(e.minEra) && Number.isInteger(e.cooldown) && e.cooldown > 0, 'invalid-event', e.id);
    need(Array.isArray(e.choices) && e.choices.length === 3, 'invalid-event-choices', e.id);
    need(e.choices.some(c => Object.keys(c.cost).length === 0), 'event-without-free-choice', e.id);
    need(new Set(e.choices.map(c => c.id)).size === e.choices.length, 'duplicate-choice-id', e.id);
    for (const c of e.choices) {
      checkQuantities(c.cost, 'invalid-choice-quantity', e.id);
      checkQuantities(c.delta, 'invalid-choice-quantity', e.id, true);
    }
  }
  const orders = new Set<number>();
  for (const c of chapters.values()) {
    need(projects.has(c.targetProjectId), 'missing-chapter-project', c.id);
    need((projects.get(c.targetProjectId) as Project).era <= c.era, 'target-later-than-chapter', c.id);
    need(biomes.has(c.recommendedBiome) && resources.has(c.focus), 'invalid-chapter-reference', c.id);
    need(c.previousChapterId === null || chapters.has(c.previousChapterId), 'invalid-previous-chapter', c.id);
    need(Number.isInteger(c.order) && !orders.has(c.order), 'duplicate-chapter-order', c.id);
    orders.add(c.order);
    for (const id of c.objectiveIds) {
      const o = objectives.get(id);
      need(o && o.chapterId === c.id, 'missing-objective', id);
    }
  }
  for (const o of objectives.values()) {
    need(chapters.has(o.chapterId) && finite(o.target), 'invalid-objective', o.id);
    if (o.kind === 'build') need(projects.has(o.projectId), 'invalid-objective-project', o.id);
    if (o.kind === 'stock') need(resources.has(o.resource), 'invalid-objective-resource', o.id);
  }
  for (const v of variants.values()) {
    need(chapters.has(v.chapterId) && biomes.has(v.biomeId), 'invalid-variant-reference', v.id);
    need(Number.isInteger(v.maxTurns) && v.maxTurns > 0, 'invalid-variant', v.id);
    checkQuantities(v.startingStock, 'invalid-starting-stock', v.id);
    need(Object.keys(v.startingStock).length === resources.size, 'invalid-starting-stock', v.id);
  }
  const hintsByProject = new Map<string, Hint[]>();
  for (const h of db.hints) {
    need(projects.has(h.projectId) && (h.level === 1 || h.level === 2 || h.level === 3), 'invalid-hint', h.id);
    const list = hintsByProject.get(h.projectId) ?? [];
    list.push(h);
    hintsByProject.set(h.projectId, list);
  }
  for (const id of projects.keys()) {
    const list = hintsByProject.get(id) ?? [];
    need(list.length === 3 && new Set(list.map(h => h.level)).size === 3, 'hint-ladder-incomplete', id);
    list.sort((a, b) => a.level - b.level);
  }
  const counts = db.manifest?.counts;
  need(isObj(counts), 'missing-manifest');
  for (const [name, n] of Object.entries(counts)) {
    const rows = (db as unknown as Record<string, unknown>)[name];
    need(Array.isArray(rows) && rows.length === n, 'manifest-count-mismatch', name);
  }

  const chaptersByOrder = [...chapters.values()].sort((a, b) => a.order - b.order);
  return deepFreeze({
    db, resources, projects, policies, events, chapters, biomes, variants, objectives, eras,
    hintsByProject, chaptersByOrder,
  });
}

/* ----------------------------- lazy loader ------------------------------- */

let cached: ContentIndex | null = null;
let pending: Promise<ContentIndex> | null = null;

/** Lazy, memoized, validated load. Concurrent callers share one fetch. */
export function loadLifelinesContent(): Promise<ContentIndex> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = import('@/data/civilization/lifelines.v1.json')
      .then(mod => {
        cached = buildContentIndex((mod as { default: unknown }).default);
        return cached;
      })
      .catch(err => { pending = null; throw err; });
  }
  return pending;
}

/** The index when it is already loaded, else null. Never triggers a load. */
export function getLoadedContent(): ContentIndex | null { return cached; }

/** Test hook. */
export function resetContentCache(): void { cached = null; pending = null; }
