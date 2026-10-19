import { run, type Providers } from './orchestrate';
import { createState } from './session';
import { rngFrom } from './rng';
import type { AskInfo, Grade, GameCommand, GameState, PoolQuestion, ProjectorConfig, TeamRef, VerifiedAnswer } from './types';
import type { QuestionKind } from './../types';
import type { EmpireG } from './reducers/empire';
import { edgeOpen, neighborsOf, reachable } from './reducers/empire';
import type { EscapeG } from './reducers/escape';
import { activeSpots, roomOf } from './reducers/escape';
import { hotspotNeeds } from './content/escape-campaigns';
import type { VaultG } from './reducers/vault';
import { payment } from './reducers/vault';
import type { LadderG } from './reducers/ladder';

export const KINDS: QuestionKind[] = ['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table'];
export function makePool(n: number, topics = ['Fractions', 'Geometry', 'Algebra', 'Data'], opts: { difficulty?: boolean } = {}): PoolQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ position: i, id: `rq-${i}`, kind: KINDS[i % 5]!, topic: topics.length ? topics[i % topics.length]! : null, difficulty: opts.difficulty === false ? 1 : (((i % 3) + 1) as 1 | 2 | 3), difficultySource: opts.difficulty === false ? 'format' : 'author', hasExplanation: true, repeatOf: null } as PoolQuestion));
}
export const makeTeams = (n: number): TeamRef[] => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, order: i }));
export const cfgOf = (game: ProjectorConfig['game'], minutes: number | null, extra: Partial<ProjectorConfig> = {}): ProjectorConfig => ({ v: 1, game, focus: 'balanced', minutes, seed: 'seed-1', settings: {}, ...extra });

export type Policy = (teamId: string, ask: AskInfo, n: number) => Grade;
export const always = (g: Grade): Policy => () => g;
export const accuracy = (p: number, seed = 'acc'): Policy => { const r = rngFrom(seed); return () => { const x = r.next(); return x < p ? 'correct' : x < p + 0.08 ? 'partial' : 'wrong'; }; };

export function fakeProviders(policy: Policy, pool: PoolQuestion[]): Providers & { subs: VerifiedAnswer[]; n: number } {
  const st = { n: 0, subs: [] as VerifiedAnswer[] };
  return Object.assign(st, {
    async open(p: { position: number; teamIds: string[] }) { return { roomQuestionId: `rq-${p.position}` }; },
    async grade(teamId: string, ask: AskInfo) {
      st.n++; const grade = policy(teamId, ask, st.n); const entry = pool.find((x) => x.position === ask.position)!;
      const a: VerifiedAnswer = { submissionId: `sub-${st.n}`, teamId, roomQuestionId: ask.roomQuestionId, position: ask.position, grade, fraction: grade === 'correct' ? 1 : grade === 'partial' ? 0.5 : 0, kind: entry.kind, topic: entry.topic, difficulty: entry.difficulty, teacherOverride: true };
      st.subs.push(a); return a;
    },
    async reveal() { /* the room row is flipped by the server; nothing to do here */ },
  });
}

/** One command the "teacher bot" would press next. Returns null when the match should simply be ended. */
export function nextCommand(state: GameState): GameCommand | null {
  const c = state.core; const game = c.game;
  if (c.phase === 'finished') return null;
  if (c.phase === 'asking') { const t = c.ask!.teamIds.find((id) => !c.ask!.answered.includes(id))!; return { action: 'grade', payload: { teamId: t } }; }
  const actor = c.teams[c.actor % c.teams.length]!.id;
  if (c.phase === 'review' || c.phase === 'resolution') return { action: 'continue' };
  if (game === 'empire_race') {
    const g = state.g as EmpireG;
    if (c.phase === 'choose') return { action: 'ask' };
    if (g.duel) return { action: 'ask' };
    const team = c.askMode === 'all' ? c.teams.find((t) => (g.energy[t.id] ?? 0) > 0)?.id ?? actor : actor;
    if ((g.energy[team] ?? 0) >= 1) {
      const tile = g.tiles.find((t) => t.owner === null && reachable(g, team, t.id));
      if (tile) return { action: 'claim', payload: { team, tile: tile.id } };
      const mine = g.tiles.find((t) => t.owner === team && !t.fort); if (mine) return { action: 'fortify', payload: { team, tile: mine.id } };
      const enemy = (g.energy[team] ?? 0) >= 2 ? g.tiles.find((t) => t.owner && t.owner !== team && reachable(g, team, t.id)) : undefined;
      if (enemy) return { action: 'challenge', payload: { team, tile: enemy.id } };
      const edge = (g.energy[team] ?? 0) >= 2 ? g.blocked.map((e) => e.split('-').map(Number) as [number, number]).find(([a, b]) => !g.bridges.includes(`${a}-${b}`) && (g.tiles[a]!.owner === team || g.tiles[b]!.owner === team)) : undefined;
      if (edge) return { action: 'bridge', payload: { team, a: edge[0], b: edge[1] } };
    }
    if (c.askMode === 'all' && c.teams.some((t) => (g.energy[t.id] ?? 0) > 0) && false) return null;
    return { action: 'end_turn' };
  }
  if (game === 'boss_battle') {
    const g = state.g as import('./reducers/boss').BossG;
    if (c.phase === 'choose') {
      const ids = c.askMode === 'all' ? c.teams.map((t) => t.id) : [actor];
      const unset = ids.find((id) => !g.teams[id]!.chosen);
      if (unset) {
        const t = g.teams[unset]!; const i = c.teams.findIndex((x) => x.id === unset);
        let action: string = 'strike';
        if (g.shared.hp <= 4) action = 'repair'; else if (g.shared.shield < 4 && i % 3 === 2) action = 'defend';
        return { action: 'choose_action', payload: { team: unset, action, aim: t.role === 'attack' ? 'weak' : 'any' } };
      }
      return { action: 'ask' };
    }
  }
  if (game === 'escape_room') {
    const g = state.g as EscapeG; const room = roomOf(g); const spots = activeSpots(g);
    const team = actor;
    const have = (n: string[]) => n.every((i) => (g.inv[g.shared ? 'shared' : team] ?? []).includes(i));
    if (g.selected && c.phase === 'choose' ) return { action: 'ask' };
    const open = spots.filter((h) => h.kind !== 'puzzle' && !g.opened.includes(h.id) && have(hotspotNeeds(h, g.maxTier)));
    const lock = open.find((h) => h.kind === 'lock'); if (lock) return { action: 'unlock', payload: { hotspot: lock.id } };
    const door = open.find((h) => h.kind === 'door'); if (door) return { action: 'unlock', payload: { hotspot: door.id } };
    if (c.phase === 'choose') {
      const q = spots.find((h) => h.question && h.tier <= 2 && !g.solved.includes(h.id) && have(hotspotNeeds(h, g.maxTier)) && (g.cooldown[h.id] ?? -1) < c.round);
      if (q) return { action: 'inspect', payload: { hotspot: q.id } };
    }
    void room; return { action: 'end_turn' };
  }
  if (game === 'treasure_vault') {
    const g = state.g as VaultG; const team = g.teams[actor]!;
    if (g.vaults.every((v) => v.opened) && g.vaults.length && g.grand.opened === false) { const r = (g.grand.need <= g.vaults.filter((v) => v.opened).length); if (r) return { action: 'open_grand', payload: { team: actor } }; }
    const affordable = g.vaults.find((v) => !v.opened && payment(team.frags, v.req, v.band));
    if (affordable) return { action: 'open', payload: { team: actor, vault: affordable.id } };
    if (team.held >= 1 && c.phase === 'planning') return { action: 'bank', payload: { team: actor } };
    if (c.phase === 'planning') return { action: 'end_turn' };
    if (c.phase === 'choose') {
      if (g.selected && !g.vaults.find((v) => v.id === g.selected)?.opened) return { action: 'ask' };
      const v = g.vaults.find((x) => !x.opened); if (v) return { action: 'choose_vault', payload: { vault: v.id } };
      return { action: 'end_turn' };
    }
  }
  if (game === 'risk_ladder') {
    const g = state.g as LadderG;
    if (c.phase === 'choose') {
      const ids = c.askMode === 'all' ? c.teams.map((t) => t.id) : [actor];
      const unset = ids.find((id) => { const t = g.teams[id]!; return !t.chosen && !(t.tier >= g.summit); });
      if (unset) { const t = g.teams[unset]!; if (t.unbanked >= 20 && t.tier - t.checkpoint >= 2) return { action: 'choose_action', payload: { team: unset, action: 'bank' } }; return { action: 'choose_action', payload: { team: unset, action: 'climb' } }; }
      if (ids.some((id) => g.teams[id]!.chosen)) return { action: 'ask' };
      return { action: 'end_turn' };
    }
  }
  return { action: 'ask' };
}

export type Outcome = { state: GameState; steps: number; errors: string[]; subs: VerifiedAnswer[]; asked: number };
export async function playToEnd(state0: GameState, pool: PoolQuestion[], policy: Policy, maxSteps = 4000): Promise<Outcome> {
  let state = state0; const prov = fakeProviders(policy, pool); const errors: string[] = []; let steps = 0; let asked = 0;
  while (state.core.phase !== 'finished' && steps < maxSteps) {
    const cmd = nextCommand(state);
    if (!cmd) break;
    const before = state.core.usedPositions.length;
    const r = await run(state, cmd, pool, prov); steps++;
    if (!r.ok) {
      errors.push(`${cmd.action}:${r.code}`);
      if (r.code === 'noQuestions') { const f = await run(state, { action: 'finish_now' }, pool, prov); if (f.ok) state = f.state; break; }
      // a bot that gets stuck ends its turn so the loop always makes progress
      const e = await run(state, { action: state.core.phase === 'review' || state.core.phase === 'resolution' ? 'continue' : 'end_turn' }, pool, prov);
      if (e.ok) state = e.state; else { const s2 = await run(state, { action: 'skip_turn', payload: { reason: 'bot stuck' } }, pool, prov); if (s2.ok) state = s2.state; else break; }
      continue;
    }
    state = r.state; if (state.core.usedPositions.length > before) asked++;
    void neighborsOf; void edgeOpen;
  }
  return { state, steps, errors, subs: prov.subs, asked };
}
export { createState, run };
