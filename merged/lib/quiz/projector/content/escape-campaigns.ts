/** Three authored escape campaigns (four rooms each). Every room is a small puzzle GRAPH, never a random key hunt:
 *  two question puzzles → a lock (needs both clues) → a door; an extended puzzle adds a second requirement; a bonus puzzle is optional.
 *  Text is deliberately functional and subject-neutral: the quiz supplies the curriculum, the room supplies the mechanism. */
import type { CampaignId, L10n } from '../types';

export type HotKind = 'puzzle' | 'lock' | 'door';
export type Hotspot = {
  id: string; slot: 'A' | 'B' | 'L' | 'D' | 'P' | 'X'; kind: HotKind; tier: 1 | 2 | 3; label: L10n; desc: L10n;
  x: number; y: number; w: number; h: number; question: boolean; diff: 1 | 2 | 3;
  needs: string[]; needsAt?: Partial<Record<2 | 3, string[]>>; grants: string | null; consumes: string[];
};
export type Item = { id: string; label: L10n; room: number };
export type EscapeRoom = { id: string; name: L10n; desc: L10n; hotspots: Hotspot[] };
export type Campaign = { id: CampaignId; name: L10n; blurb: L10n; rooms: EscapeRoom[]; items: Record<string, Item> };

/** Four hand-placed layouts (scene space 1000×600) so rooms do not look alike. Rects: x,y,w,h per slot A B L D P X. */
const LAYOUTS: Record<string, [number, number, number, number][]> = {
  a: [[90, 300, 190, 190], [330, 360, 200, 150], [560, 250, 170, 210], [790, 190, 160, 300], [350, 120, 180, 130], [640, 500, 150, 70]],
  b: [[110, 190, 180, 200], [310, 410, 210, 140], [600, 150, 170, 220], [800, 220, 150, 290], [60, 450, 190, 110], [460, 50, 120, 90]],
  c: [[140, 330, 170, 200], [370, 150, 200, 160], [620, 330, 180, 200], [820, 160, 140, 320], [60, 120, 200, 130], [420, 480, 190, 80]],
  d: [[80, 160, 200, 170], [340, 330, 190, 190], [570, 130, 190, 200], [790, 260, 160, 280], [600, 440, 160, 110], [300, 90, 160, 90]],
};
type Prop = [string, string, string]; // label, description, item given

function mk(cid: string, ri: number, layout: keyof typeof LAYOUTS, name: L10n, desc: L10n, p: { A: Prop; B: Prop; L: Prop; D: Prop; P: Prop; X: Prop }): { room: EscapeRoom; items: Item[] } {
  const L = LAYOUTS[layout]!; const id = (s: string) => `${cid}${ri}_${s}`;
  const slot = (s: 'A' | 'B' | 'L' | 'D' | 'P' | 'X', i: number, kind: HotKind, tier: 1 | 2 | 3, question: boolean, diff: 1 | 2 | 3, extra: Partial<Hotspot>): Hotspot => {
    const pr = p[s]; const r = L[i]!;
    return { id: id(s), slot: s, kind, tier, label: { en: pr[0] }, desc: { en: pr[1] }, x: r[0], y: r[1], w: r[2], h: r[3], question, diff, needs: [], grants: null, consumes: [], ...extra };
  };
  const items: Item[] = [];
  const item = (s: string, en: string) => { items.push({ id: id(s), label: { en }, room: ri }); return id(s); };
  const a = item('a', p.A[2]), b = item('b', p.B[2]);
  const key = item('key', p.L[2]), d = item('d', p.P[2]), seal = item('seal', p.X[2]);
  const hotspots: Hotspot[] = [
    slot('A', 0, 'puzzle', 1, true, 1, { grants: a }), slot('B', 1, 'puzzle', 1, true, 2, { grants: b }),
    slot('L', 2, 'lock', 1, false, 1, { needs: [a, b], consumes: [a, b], grants: key }),
    slot('D', 3, 'door', 1, false, 1, { needs: [key], needsAt: { 2: [d] } }),
    slot('P', 4, 'puzzle', 2, true, 2, { grants: d }), slot('X', 5, 'puzzle', 3, true, 3, { grants: seal }),
  ];
  return { room: { id: id('room'), name, desc, hotspots }, items };
}
// prop tuple: [label, description, item given]
function campaign(id: CampaignId, name: L10n, blurb: L10n, rooms: ReturnType<typeof mk>[]): Campaign {
  const items: Record<string, Item> = {}; rooms.forEach((r) => r.items.forEach((i) => { items[i.id] = i; }));
  return { id, name, blurb, rooms: rooms.map((r) => r.room), items };
}

export const CLOCKHOUSE = campaign('clockhouse', { en: 'Clockhouse' }, { en: 'Brass gears, pendulums and a stopped tower clock.' }, [
  mk('clk', 1, 'a', { en: 'Hour Hall' }, { en: 'A tall hall with a stopped hour wheel.' }, {
    A: ['Hour wheel', 'A wheel of twelve etched marks.', 'Etched gear mark'],
    B: ['Ledger desk', 'A ledger with a table of entries.', 'Ratio card'],
    L: ['Dial cabinet', 'A cabinet with two empty slots.', 'Brass dial key'],
    D: ['Pendulum door', 'A door held by a swinging bar.', '-'],
    P: ['Weight chain', 'A chain with a missing weight.', 'Counterweight tag'],
    X: ['Music box', 'A small box that hums when wound.', 'Hall seal'],
  }),
  mk('clk', 2, 'b', { en: 'Pendulum Gallery' }, { en: 'Long pendulums sweep across the floor.' }, {
    A: ['Swing arc chart', 'A chart of swing arcs on the wall.', 'Arc stamp'],
    B: ['Counter board', 'A board that counts each swing.', 'Count token'],
    L: ['Escapement lock', 'A lock that needs a stamp and a token.', 'Escapement key'],
    D: ['Gallery door', 'A door with a ticking bolt.', '-'],
    P: ['Bob stand', 'A stand holding spare bobs.', 'Bob tag'],
    X: ['Brass bell', 'A bell on a short cord.', 'Gallery seal'],
  }),
  mk('clk', 3, 'c', { en: 'Spring Workshop' }, { en: 'Benches of coiled springs and tools.' }, {
    A: ['Spring rack', 'Springs sorted by length.', 'Spring gauge'],
    B: ['Parts table', 'A table of parts and counts.', 'Parts list'],
    L: ['Tool chest', 'A chest with a two-part latch.', 'Workshop key'],
    D: ['Bench door', 'A door behind the long bench.', '-'],
    P: ['Winding crank', 'A crank with a notched wheel.', 'Crank tag'],
    X: ['Oil lamp', 'A lamp that flickers on and off.', 'Workshop seal'],
  }),
  mk('clk', 4, 'd', { en: 'Tower Belfry' }, { en: 'The great clock face and the last door.' }, {
    A: ['Great hands', 'Two hands stuck at different times.', 'Hand pin'],
    B: ['Bell ropes', 'Ropes labelled with numbers.', 'Rope tally'],
    L: ['Face latch', 'A latch behind the clock face.', 'Belfry key'],
    D: ['Belfry exit', 'The final door to the street.', '-'],
    P: ['Pulley frame', 'A frame with a missing pulley.', 'Pulley tag'],
    X: ['Weather vane', 'A vane that turns in the draft.', 'Belfry seal'],
  }),
]);

export const CELESTIAL = campaign('celestial_archive', { en: 'Celestial Archive' }, { en: 'Shelves of star charts under a glass dome.' }, [
  mk('cel', 1, 'c', { en: 'Reading Rotunda' }, { en: 'A round room of shelves and ladders.' }, {
    A: ['Card catalogue', 'Drawers of index cards.', 'Index card'],
    B: ['Reading lamp table', 'A table with an open chart.', 'Chart page'],
    L: ['Shelf lock', 'A shelf locked with two sockets.', 'Rotunda key'],
    D: ['Archive door', 'A door set in the shelving.', '-'],
    P: ['Ladder rail', 'A rail with a stuck ladder.', 'Ladder tag'],
    X: ['Globe stand', 'A globe that spins freely.', 'Rotunda seal'],
  }),
  mk('cel', 2, 'a', { en: 'Star Chart Vault' }, { en: 'Flat drawers of large star charts.' }, {
    A: ['Chart drawer', 'A drawer with a torn corner.', 'Chart corner'],
    B: ['Light table', 'A glass table lit from below.', 'Overlay sheet'],
    L: ['Vault lock', 'A lock with two drawer slots.', 'Vault key'],
    D: ['Vault door', 'A flat door set in the wall.', '-'],
    P: ['Compass stand', 'A stand with no compass.', 'Compass tag'],
    X: ['Pinned moth case', 'A case of pinned wings.', 'Vault seal'],
  }),
  mk('cel', 3, 'b', { en: 'Orrery Hall' }, { en: 'Brass rings turn slowly overhead.' }, {
    A: ['Inner ring', 'A ring with a gap.', 'Ring bead'],
    B: ['Outer ring', 'A ring with unlabelled marks.', 'Mark key'],
    L: ['Orrery lock', 'A lock between two rings.', 'Orrery key'],
    D: ['Hall door', 'A door behind the sun model.', '-'],
    P: ['Gear crank', 'A crank for the outer ring.', 'Crank mark'],
    X: ['Moon dial', 'A dial showing phases.', 'Hall seal'],
  }),
  mk('cel', 4, 'd', { en: 'Dome Observatory' }, { en: 'A telescope under an open dome.' }, {
    A: ['Telescope mount', 'A mount with two settings.', 'Lens cap'],
    B: ['Observation log', 'A log with a table of readings.', 'Log page'],
    L: ['Dome latch', 'A latch with two sockets.', 'Dome key'],
    D: ['Observatory exit', 'The final stair door.', '-'],
    P: ['Focus wheel', 'A wheel that will not turn.', 'Focus tag'],
    X: ['Star lamp', 'A lamp with a shaped shade.', 'Dome seal'],
  }),
]);

export const GLASS_GARDEN = campaign('glass_garden', { en: 'Glass Garden' }, { en: 'Greenhouses of prisms, ferns and brass pipes.' }, [
  mk('gg', 1, 'b', { en: 'Potting Greenhouse' }, { en: 'Rows of pots and a watering rail.' }, {
    A: ['Seed tray', 'A tray with labelled rows.', 'Seed label'],
    B: ['Watering schedule', 'A schedule with blank cells.', 'Schedule slip'],
    L: ['Pipe valve', 'A valve with two handles.', 'Valve key'],
    D: ['Glass door', 'A door of small panes.', '-'],
    P: ['Pot rack', 'A rack missing one pot.', 'Pot tag'],
    X: ['Trowel hook', 'A hook with a small trowel.', 'Pot seal'],
  }),
  mk('gg', 2, 'd', { en: 'Prism Arcade' }, { en: 'Panes that split light into bands.' }, {
    A: ['Red pane', 'A pane that tints the light.', 'Pane filter'],
    B: ['Prism stand', 'A prism on a rotating stand.', 'Prism angle'],
    L: ['Light lock', 'A lock with two light sockets.', 'Arcade key'],
    D: ['Arcade door', 'A door of coloured glass.', '-'],
    P: ['Mirror frame', 'A frame with a missing mirror.', 'Mirror tag'],
    X: ['Glass bell jar', 'A bell jar over a small plant.', 'Arcade seal'],
  }),
  mk('gg', 3, 'a', { en: 'Fern Atrium' }, { en: 'Tall ferns around a stone basin.' }, {
    A: ['Frond press', 'A press holding a leaf pattern.', 'Leaf rubbing'],
    B: ['Basin gauge', 'A gauge with marked levels.', 'Level note'],
    L: ['Basin lock', 'A lock under the water line.', 'Atrium key'],
    D: ['Atrium gate', 'An iron gate with a vine.', '-'],
    P: ['Trellis frame', 'A trellis missing a rung.', 'Trellis tag'],
    X: ['Stone toad', 'A statue with a hollow base.', 'Atrium seal'],
  }),
  mk('gg', 4, 'c', { en: 'Lantern Conservatory' }, { en: 'Hanging lanterns and the last gate.' }, {
    A: ['Lantern chain', 'Lanterns that light in sequence.', 'Lantern wick'],
    B: ['Seed ledger', 'A ledger of counts per row.', 'Ledger page'],
    L: ['Roof latch', 'A latch above the door.', 'Conservatory key'],
    D: ['Conservatory exit', 'The final door to the garden.', '-'],
    P: ['Pipe organ', 'Pipes missing one note.', 'Pipe tag'],
    X: ['Sundial', 'A dial with a bent gnomon.', 'Final seal'],
  }),
]);

export const CAMPAIGNS: Record<CampaignId, Campaign> = { clockhouse: CLOCKHOUSE, celestial_archive: CELESTIAL, glass_garden: GLASS_GARDEN };
export const CAMPAIGN_IDS = Object.keys(CAMPAIGNS) as CampaignId[];

export const doorNeeds = (h: Hotspot, maxTier: 1 | 2 | 3): string[] => [...h.needs, ...(maxTier >= 2 ? h.needsAt?.[2] ?? [] : []), ...(maxTier >= 3 ? h.needsAt?.[3] ?? [] : [])];
export const hotspotNeeds = (h: Hotspot, maxTier: 1 | 2 | 3) => (h.kind === 'door' ? doorNeeds(h, maxTier) : h.needs);

export type ValidationReport = { ok: boolean; errors: string[]; questions: number };
/** Every room must be completable from a clean state using only authored actions. No cycles, no stranded locks, no unreachable exit. */
export function validateCampaign(c: Campaign, rooms: number, maxTier: 1 | 2 | 3): ValidationReport {
  const errors: string[] = []; let questions = 0;
  for (const room of c.rooms.slice(0, rooms)) {
    const active = room.hotspots.filter((h) => h.tier <= maxTier);
    const have = new Set<string>(); const done = new Set<string>(); let progress = true;
    while (progress) {
      progress = false;
      for (const h of active) {
        if (done.has(h.id)) continue;
        const req = hotspotNeeds(h, maxTier);
        if (req.every((i) => have.has(i))) { done.add(h.id); progress = true; if (h.grants) have.add(h.grants); h.consumes.forEach(() => undefined); }
      }
    }
    for (const h of active) {
      if (!done.has(h.id)) errors.push(`${room.id}:${h.id} is unreachable (needs ${hotspotNeeds(h, maxTier).join(',')})`);
      if (h.question) questions++;
      for (const need of hotspotNeeds(h, maxTier)) if (!c.items[need]) errors.push(`${h.id} needs unknown item ${need}`);
      if (h.grants && !c.items[h.grants]) errors.push(`${h.id} grants unknown item ${h.grants}`);
    }
    const door = room.hotspots.find((h) => h.kind === 'door');
    if (!door || !done.has(door.id)) errors.push(`${room.id}: exit not reachable`);
    // consumed items must not be needed again by a later requirement in the same room (would strand the player)
    for (const l of active.filter((h) => h.consumes.length)) for (const other of active) if (other !== l && other.id !== l.id && hotspotNeeds(other, maxTier).some((n) => l.consumes.includes(n))) errors.push(`${room.id}: ${other.id} needs an item consumed by ${l.id}`);
    // overlap check on hit areas
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!, b = active[j]!;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) errors.push(`${room.id}: ${a.id} overlaps ${b.id}`);
    }
  }
  return { ok: errors.length === 0, errors, questions };
}
export const questionsRequired = (c: Campaign, rooms: number, maxTier: 1 | 2 | 3) => validateCampaign(c, rooms, maxTier).questions;
