import { createRng } from '../../seed';
import { reachableDistricts } from './network';
import {
  ALTERNATE_LINK_COST, LINK_CAPACITY, MAX_LINK_CAPACITY, WORN_CONDITION, districtAllows, linkSupports, serviceLinkType,
} from './rules';
import {
  MILLI, RESOURCE_IDS, type Chapter, type ContentIndex, type District, type Layout, type Link, type LinkType,
  type PotentialLink, type ResourceId, type TerrainTag,
} from './schema';

/* ============================================================================
   LIFELINES LAYOUT GENERATOR — a small valid district map from the scenario
   seed. Constraints, checked by validateLayout before a layout is exposed:
     • links connect existing districts, never self-loop, never duplicate an
       identical (type + endpoints) connection, and stay under a capacity cap
       (so repeated edges cannot make free infinite throughput);
     • every service has a supply district and can reach every demand district;
     • the chapter's target programme has at least one legal location;
     • the first chapters have NO worn link (they are for inspecting, not fixing);
     • later chapters carry exactly one potential bottleneck and one alternate
       route opportunity.
   Bounded attempts; on failure a known-valid fallback is used and recorded.
   The layout is stored in the save: a content update never redraws a map.
   ========================================================================== */

export const GENERATOR_VERSION = 1 as const;
const MAX_ATTEMPTS = 8;
const NAMES = [
  'Riverside', 'Upper Fields', 'Market Row', 'Old Quarter', 'Lower Terrace', 'The Ridge', 'Harbour Reach',
  'Orchard Lane', 'Stonebridge', 'Long Meadow', 'North Common', 'Low Ford',
] as const;

export function districtCountFor(era: number): number {
  if (era <= 2) return 3;
  if (era <= 6) return 5;
  return 7;
}

/** Split `total` (milli) across weights deterministically; the remainder goes to the earliest districts. */
export function distribute(total: number, parts: readonly number[]): number[] {
  const sum = parts.reduce((a, b) => a + b, 0) || 1;
  const out = parts.map(p => Math.floor((total * p) / sum));
  let rest = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % out.length) { out[i]++; rest--; }
  return out;
}

function anchors(count: number, rng: ReturnType<typeof createRng>): { x: number; y: number }[] {
  // Fixed slots on a loose ring around a central slot, lightly jittered; legible, never overlapping.
  const slots: [number, number][] = [
    [500, 300], [215, 210], [790, 215], [250, 440], [760, 450], [500, 110], [500, 490],
  ];
  return slots.slice(0, count).map(([x, y], i) => (i === 0
    ? { x, y }
    : { x: Math.round(x + (rng.next() - 0.5) * 50), y: Math.round(y + (rng.next() - 0.5) * 36) }));
}

function terrainFor(count: number, rng: ReturnType<typeof createRng>): TerrainTag[][] {
  const out: TerrainTag[][] = [['flat']];
  const pool: TerrainTag[] = ['fertile', 'water', 'upland', 'wild', 'flat', 'fertile', 'water'];
  const must: TerrainTag[] = count >= 5 ? ['water', 'fertile', 'wild'] : ['water', 'fertile'];
  const rest = rng.shuffle(pool);
  for (let i = 1; i < count; i++) {
    const tag = must[i - 1] ?? rest[i % rest.length];
    const extra = rng.chance(0.35) ? rest[(i + 2) % rest.length] : null;
    out.push(extra && extra !== tag ? [tag, extra] : [tag]);
  }
  return out;
}

function weightsFor(ids: readonly string[], terrain: Record<string, TerrainTag[]>, focusService: ResourceId, rng: ReturnType<typeof createRng>) {
  const demand = {} as Record<ResourceId, Record<string, number>>;
  const supply = {} as Record<ResourceId, Record<string, number>>;
  const popular = ids.map((_, i) => (i === 0 ? 3 : 2) + rng.int(0, 2));
  // The focus service's demand leans on one non-central district, so the lesson has somewhere to land.
  const leaning = ids.length > 1 ? 1 + rng.int(0, ids.length - 2) : 0;
  for (const r of RESOURCE_IDS) {
    const dw = popular.map((p, i) => (r === focusService && i === leaning ? p + 5 : p));
    const dd = distribute(1000, dw);
    const sw = ids.map((id, i) => {
      const t = terrain[id];
      if (r === 'water') return t.includes('water') ? 6 : 1;
      if (r === 'food') return t.includes('fertile') ? 6 : 1;
      if (r === 'ecology') return t.includes('wild') ? 5 : 1;
      if (r === 'energy') return t.includes('upland') || t.includes('flat') ? 3 : 1;
      return i === 0 ? 4 : 1;
    });
    const ss = distribute(1000, sw);
    demand[r] = {}; supply[r] = {};
    ids.forEach((id, i) => { demand[r][id] = dd[i]; supply[r][id] = ss[i]; });
  }
  return { demand, supply, leaning };
}

function linkId(type: LinkType, a: string, b: string): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${type}:${x}~${y}`;
}

function buildLinks(ids: readonly string[], pos: Record<string, { x: number; y: number }>, era: number): { links: Link[]; tree: [string, string][] } {
  // Prim's tree from the central district, nearest-first, ties broken by id.
  const inTree = new Set<string>([ids[0]]);
  const tree: [string, string][] = [];
  const d2 = (a: string, b: string) => (pos[a].x - pos[b].x) ** 2 + (pos[a].y - pos[b].y) ** 2;
  while (inTree.size < ids.length) {
    let best: [string, string] | null = null, bestD = Infinity;
    for (const a of [...inTree].sort()) for (const b of ids) {
      if (inTree.has(b)) continue;
      const d = d2(a, b);
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    if (!best) break;
    tree.push(best); inTree.add(best[1]);
  }
  const types: LinkType[] = era < 3 ? ['path'] : ['path', 'channel', 'power', 'knowledge'];
  const links: Link[] = [];
  for (const [a, b] of tree) for (const type of types) {
    links.push({
      id: linkId(type, a, b), type, a, b, directed: false, capacity: LINK_CAPACITY[type], condition: 1000,
      supports: linkSupports(type, era),
    });
  }
  return { links, tree };
}

export function validateLayout(layout: Layout, index: ContentIndex, chapter: Chapter): string | null {
  const ids = new Set(layout.districts.map(d => d.id));
  if (ids.size !== layout.districts.length || layout.districts.length < 3 || layout.districts.length > 7) return 'district-count';
  if (layout.districts.filter(d => d.storage).length !== 1) return 'storage-district';
  const seen = new Set<string>();
  for (const l of [...layout.links, ...layout.potentialLinks]) {
    if (!ids.has(l.a) || !ids.has(l.b) || l.a === l.b) return `bad-endpoints:${l.id}`;
    if (!Number.isFinite(l.capacity) || l.capacity <= 0 || l.capacity > MAX_LINK_CAPACITY) return `bad-capacity:${l.id}`;
    const key = `${l.type}|${[l.a, l.b].sort().join('|')}`;
    if (seen.has(key)) return `duplicate-connection:${l.id}`;
    seen.add(key);
  }
  for (const l of layout.links) if (l.condition < 0 || l.condition > 1000) return `bad-condition:${l.id}`;
  for (const r of RESOURCE_IDS) {
    const supplyIds = layout.districts.filter(d => d.supplyWeights[r] > 0).map(d => d.id);
    if (supplyIds.length === 0) return `no-supply:${r}`;
    if (layout.districts.reduce((s, d) => s + d.demandWeights[r], 0) !== 1000) return `demand-weights:${r}`;
    if (layout.districts.reduce((s, d) => s + d.supplyWeights[r], 0) !== 1000) return `supply-weights:${r}`;
    // Reachability: every demand district can be reached from every supply district over links carrying r.
    for (const s of supplyIds) {
      const reach = reachableDistricts(layout, r, s);
      for (const d of layout.districts) if (d.demandWeights[r] > 0 && !reach.has(d.id)) return `unreachable:${r}:${d.id}`;
    }
    // …and the store can both receive from and serve every district.
    const store = layout.districts.find(d => d.storage) as District;
    const fromStore = reachableDistricts(layout, r, store.id);
    for (const d of layout.districts) if (!fromStore.has(d.id)) return `store-unreachable:${r}:${d.id}`;
  }
  const target = index.projects.get(chapter.targetProjectId);
  if (!target || !layout.districts.some(d => districtAllows(d.terrain, target.sector))) return 'no-legal-location';
  if (chapter.order <= 3) {
    if (layout.bottleneckLinkId !== null || layout.links.some(l => l.condition !== 1000)) return 'early-chapter-worn-link';
  } else {
    if (layout.bottleneckLinkId === null || !layout.links.some(l => l.id === layout.bottleneckLinkId)) return 'missing-bottleneck';
    if (layout.alternateLinkId === null || !layout.potentialLinks.some(l => l.id === layout.alternateLinkId)) return 'missing-alternate';
  }
  return null;
}

function generateOnce(seed: string, chapter: Chapter, attempt: number): Layout {
  const rng = createRng(`${seed}:layout:v${GENERATOR_VERSION}:${attempt}`);
  const count = districtCountFor(chapter.era);
  const ids = Array.from({ length: count }, (_, i) => `d${i + 1}`);
  const pos = anchors(count, rng);
  const terrainList = terrainFor(count, rng);
  const terrain: Record<string, TerrainTag[]> = {};
  const position: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, i) => { terrain[id] = terrainList[i]; position[id] = pos[i]; });
  const nameStart = rng.int(0, NAMES.length - 1);
  const w = weightsFor(ids, terrain, chapter.focus, rng);
  const districts: District[] = ids.map((id, i) => ({
    id,
    name: i === 0 ? 'Central Homes' : NAMES[(nameStart + i) % NAMES.length],
    anchor: position[id],
    terrain: terrain[id],
    storage: i === 0,
    demandWeights: Object.fromEntries(RESOURCE_IDS.map(r => [r, w.demand[r][id]])) as Record<ResourceId, number>,
    supplyWeights: Object.fromEntries(RESOURCE_IDS.map(r => [r, w.supply[r][id]])) as Record<ResourceId, number>,
  }));
  const { links, tree } = buildLinks(ids, position, chapter.era);

  let bottleneckLinkId: string | null = null;
  let alternateLinkId: string | null = null;
  const potentialLinks: PotentialLink[] = [];
  if (chapter.order > 3) {
    const demandDistrict = ids[w.leaning];
    const type = serviceLinkType(chapter.focus, chapter.era);
    const worn = links.find(l => l.type === type && (l.a === demandDistrict || l.b === demandDistrict));
    if (worn) { worn.condition = WORN_CONDITION; bottleneckLinkId = worn.id; }
    // Alternate route: a not-yet-built connection between two districts the tree does not join directly.
    const adjacent = new Set(tree.map(([a, b]) => [a, b].sort().join('|')));
    outer: for (const a of ids) for (const b of ids) {
      if (a >= b || adjacent.has([a, b].sort().join('|'))) continue;
      if (a !== demandDistrict && b !== demandDistrict && ids.length > 3) continue;
      const id = `alt:${linkId(type, a, b)}`;
      potentialLinks.push({
        id, type, a, b, capacity: Math.min(MAX_LINK_CAPACITY, LINK_CAPACITY[type] + 4 * MILLI),
        supports: linkSupports(type, chapter.era), cost: { ...ALTERNATE_LINK_COST },
      });
      alternateLinkId = id;
      break outer;
    }
  }
  return {
    generator: { version: GENERATOR_VERSION, attempt, fallbackUsed: false },
    districts, links, potentialLinks, bottleneckLinkId, alternateLinkId,
  };
}

/** A fixed, hand-checkable layout for the rare case the bounded generator cannot produce a valid one. */
export function fallbackLayout(chapter: Chapter, index: ContentIndex): Layout {
  const count = districtCountFor(chapter.era);
  const ids = Array.from({ length: count }, (_, i) => `d${i + 1}`);
  const slots = anchors(count, createRng('fallback'));
  const terrain: TerrainTag[][] = ids.map((_, i) => (i === 0 ? ['flat', 'fertile', 'water'] : ['flat', 'fertile', 'water', 'wild'].slice(0, 2 + (i % 3)) as TerrainTag[]));
  const even = distribute(1000, ids.map(() => 1));
  const districts: District[] = ids.map((id, i) => ({
    id, name: i === 0 ? 'Central Homes' : NAMES[i], anchor: slots[i], terrain: terrain[i], storage: i === 0,
    demandWeights: Object.fromEntries(RESOURCE_IDS.map(r => [r, even[i]])) as Record<ResourceId, number>,
    supplyWeights: Object.fromEntries(RESOURCE_IDS.map(r => [r, even[i]])) as Record<ResourceId, number>,
  }));
  const types: LinkType[] = chapter.era < 3 ? ['path'] : ['path', 'channel', 'power', 'knowledge'];
  const links: Link[] = [];
  for (let i = 1; i < ids.length; i++) for (const type of types) {
    links.push({ id: linkId(type, ids[0], ids[i]), type, a: ids[0], b: ids[i], directed: false, capacity: LINK_CAPACITY[type], condition: 1000, supports: linkSupports(type, chapter.era) });
  }
  let bottleneckLinkId: string | null = null;
  let alternateLinkId: string | null = null;
  const potentialLinks: PotentialLink[] = [];
  if (chapter.order > 3) {
    const type = serviceLinkType(chapter.focus, chapter.era);
    const worn = links.find(l => l.type === type && l.b === ids[ids.length - 1]) as Link;
    worn.condition = WORN_CONDITION; bottleneckLinkId = worn.id;
    const id = `alt:${linkId(type, ids[1], ids[2])}`;
    potentialLinks.push({ id, type, a: ids[1], b: ids[2], capacity: LINK_CAPACITY[type] + 4 * MILLI, supports: linkSupports(type, chapter.era), cost: { ...ALTERNATE_LINK_COST } });
    alternateLinkId = id;
  }
  const layout: Layout = { generator: { version: GENERATOR_VERSION, attempt: -1, fallbackUsed: true }, districts, links, potentialLinks, bottleneckLinkId, alternateLinkId };
  void index;
  return layout;
}

/** The scenario's layout: bounded attempts, then the recorded fallback. Deterministic in (seed, chapter). */
export function generateLayout(seed: string, chapter: Chapter, index: ContentIndex): Layout {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const layout = generateOnce(seed, chapter, attempt);
    if (validateLayout(layout, index, chapter) === null) return layout;
  }
  return fallbackLayout(chapter, index);
}
