import type { CampState, CampEvent, Member, Task, TaskKind, Trait } from './types';

/* ============================================================================
   SURVIVAL SIMULATION CORE — pure, deterministic (no Math.random; any
   variation a future pass adds should come from lib/seed.ts). One call to
   `advanceTick` resolves one period (morning/day/evening/night): every
   member's assigned task, universal need decay, fire/resource consumption,
   and win/loss checks. The UI (components/survival/) only ever calls this
   and re-renders — it holds no simulation logic of its own.
   ========================================================================== */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const TRAIT_BONUS: Partial<Record<Trait, Partial<Record<TaskKind, number>>>> = {
  'strong-carrier': { 'gather-wood': 0.5, 'build-shelter': 0.3 },
  observant: { 'gather-food': 0.4 },
  'patient-craftsperson': { 'tend-fire': 0.3, 'build-shelter': 0.2 },
  'cautious-explorer': { 'fetch-water': 0.3 },
  'quick-learner': {},
};

function traitBonus(trait: Trait, task: TaskKind): number {
  return TRAIT_BONUS[trait]?.[task] ?? 0;
}

function tileAt(state: CampState, x: number, y: number) {
  return state.terrain.tiles[y]?.[x];
}

function pushLog(events: CampEvent[], state: Pick<CampState, 'day' | 'period'>, text: string) {
  events.push({ day: state.day, period: state.period, text });
}

function resolveTask(state: CampState, member: Member, events: CampEvent[]) {
  const task: Task = member.task ?? { kind: 'idle', x: state.terrain.campX, y: state.terrain.campY };
  const bonus = traitBonus(member.trait, task.kind);

  switch (task.kind) {
    case 'gather-wood': {
      if (tileAt(state, task.x, task.y) !== 'woodland') break;
      const amount = 0.4 + bonus;
      state.resources.wood += amount;
      member.energy = clamp01(member.energy - 0.12);
      break;
    }
    case 'gather-food': {
      if (state.period === 'night') { member.energy = clamp01(member.energy - 0.05); break; }
      if (tileAt(state, task.x, task.y) !== 'woodland' && tileAt(state, task.x, task.y) !== 'open') break;
      const amount = 0.45 + bonus;
      state.resources.food += amount;
      member.energy = clamp01(member.energy - 0.12);
      break;
    }
    case 'fetch-water': {
      if (tileAt(state, task.x, task.y) !== 'water') break;
      const amount = 0.55 + bonus;
      state.resources.water += amount;
      member.energy = clamp01(member.energy - 0.1);
      break;
    }
    case 'tend-fire': {
      if (state.resources.wood >= 0.2) {
        state.resources.wood -= 0.2;
        state.fire.fuel = clamp01(state.fire.fuel + 0.3 + bonus);
        if (!state.fire.lit && state.fire.fuel > 0.25) {
          state.fire.lit = true;
          if (!state.milestones.fire) {
            state.milestones.fire = true;
            pushLog(events, state, `${member.name} coaxes the first real flame the camp has held.`);
          }
        }
      }
      member.energy = clamp01(member.energy - 0.08);
      break;
    }
    case 'build-shelter': {
      if (state.shelter.level < 3 && state.resources.wood >= 0.5) {
        state.resources.wood -= 0.5;
        state.shelter.level = (state.shelter.level + 1) as typeof state.shelter.level;
        member.energy = clamp01(member.energy - 0.15 + bonus * 0.1);
        if (state.shelter.level === 1 && !state.milestones.shelter) {
          state.milestones.shelter = true;
          pushLog(events, state, `${member.name} raises the first windbreak against the open ground.`);
        }
      }
      break;
    }
    case 'rest': {
      member.energy = clamp01(member.energy + 0.28);
      member.morale = clamp01(member.morale + 0.1);
      break;
    }
    case 'idle':
      break;
  }
}

function applyNeedDecay(state: CampState, member: Member) {
  if (member.task?.kind !== 'rest') member.energy = clamp01(member.energy - 0.05);
  const sheltered = state.shelter.level > 0;
  const warmSource = state.fire.lit || (sheltered && state.shelter.level >= 2);
  let warmthLoss = state.period === 'night' ? 0.12 : 0.04;
  if (warmSource) warmthLoss *= 0.35;
  else if (sheltered) warmthLoss *= 0.7;
  member.warmth = clamp01(member.warmth - warmthLoss);
  let moraleDelta = -0.02;
  if (state.fire.lit) moraleDelta += 0.01;
  if (member.warmth < 0.2 || member.energy < 0.2) moraleDelta -= 0.04;
  member.morale = clamp01(member.morale + moraleDelta);
  if (member.warmth <= 0 && member.energy <= 0) member.injured = true;
}

const PERIOD_ORDER = ['morning', 'day', 'evening', 'night'] as const;

export function advanceTick(input: CampState, assignments: Record<string, Task>): { state: CampState; events: CampEvent[] } {
  // CampState is plain JSON-serializable data (no functions, Dates, Sets or
  // Maps) — a stringify/parse round trip is a safe, environment-portable
  // deep clone (structuredClone isn't available in every test environment).
  const state: CampState = JSON.parse(JSON.stringify(input));
  const events: CampEvent[] = [];

  for (const m of state.members) {
    if (m.injured) continue;
    m.task = assignments[m.id] ?? null;
  }

  // A new day's morning consumes the previous day's stores.
  if (state.period === 'morning') {
    const need = state.members.filter(m => !m.injured).length || 1;
    const foodNeed = need * 0.5;
    const waterNeed = need * 0.6;
    const shortFood = state.resources.food < foodNeed;
    const shortWater = state.resources.water < waterNeed;
    state.resources.food = Math.max(0, state.resources.food - foodNeed);
    state.resources.water = Math.max(0, state.resources.water - waterNeed);
    if (shortFood || shortWater) {
      for (const m of state.members) { m.energy = clamp01(m.energy - 0.15); m.morale = clamp01(m.morale - 0.08); }
      pushLog(events, state, shortFood && shortWater ? 'Food and water both ran short this morning.'
        : shortFood ? 'There was not enough food to go around this morning.' : 'The water ran low this morning.');
    }
  }

  for (const m of state.members) {
    if (m.injured) continue;
    resolveTask(state, m, events);
  }

  if (state.fire.lit) {
    state.fire.fuel = clamp01(state.fire.fuel - 0.15);
    if (state.fire.fuel <= 0) { state.fire.lit = false; pushLog(events, state, 'The fire has gone out.'); }
  }

  for (const m of state.members) {
    if (m.injured) continue;
    applyNeedDecay(state, m);
    if (m.injured) pushLog(events, state, `${m.name} can no longer keep going without rest and care.`);
  }

  // Advance the clock.
  const idx = PERIOD_ORDER.indexOf(state.period);
  if (idx === PERIOD_ORDER.length - 1) { state.period = PERIOD_ORDER[0]; state.day += 1; } else { state.period = PERIOD_ORDER[idx + 1]; }

  const allInjured = state.members.every(m => m.injured);
  const avgMorale = state.members.reduce((s, m) => s + m.morale, 0) / state.members.length;
  if (allInjured || avgMorale <= 0) {
    state.ending = 'failed';
  } else if (state.day > state.objective.targetDay) {
    state.ending = 'success';
  }

  // Persisted history, capped — the UI reads state.log directly so a
  // resumed run still shows what already happened, not just new events.
  state.log = [...state.log, ...events].slice(-40);

  return { state, events };
}
