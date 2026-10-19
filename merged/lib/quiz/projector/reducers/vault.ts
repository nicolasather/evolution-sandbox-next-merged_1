/** TREASURE VAULT — lock-and-key strategy. Correct answers earn shaped key fragments (one shape per SKILL); doors need the right combination. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, finish, fx, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';
import { DOORS, SHAPES, type DoorMech, type Shape } from '../content/vault-doors';
import { rngFrom } from '../rng';

export type Vault = { id: string; door: DoorMech; variant: number; topic: string | null; band: 1 | 2 | 3; req: Shape[]; reward: number; range: [number, number]; opened: boolean; claim: string | null };
export type VaultTeam = { frags: Record<string, number>; held: number; banked: number; opened: string[]; scanner: number; practiced: string[]; shares: number };
export type VaultG = {
  vaults: Vault[]; skills: string[]; skillShape: Record<string, Shape>; teams: Record<string, VaultTeam>; selected: string | null; skill: string | null;
  grand: { reward: number; range: [number, number]; need: number; opened: boolean; claim: string | null }; checkpoint: boolean; collab: number; lastScan: { team: string; skill: string | null } | null;
  last: { team: string; frags: number; shape: Shape | null } | null; singleSkill: boolean;
};
const RANGES: Record<1 | 2 | 3, [number, number]> = { 1: [10, 15], 2: [18, 25], 3: [30, 40] };
export const SCANNER_COST = 5;
const shapeOfSkill = (g: VaultG, skill: string | null): Shape => (skill && g.skillShape[skill]) || 'circle';

export function makeVaults(count: number, skills: string[], seed: string, shapeOf: Record<string, Shape>): Vault[] {
  const rng = rngFrom(`${seed}:vault`); const doors = rng.shuffle(DOORS.map((d) => d.id)); const out: Vault[] = [];
  const multi = skills.length >= 2;
  for (let i = 0; i < count; i++) {
    const frac = (i + 0.5) / count; const band: 1 | 2 | 3 = !multi ? 1 : frac < 0.4 ? 1 : frac < 0.75 ? 2 : 3;
    const topic = skills[i % skills.length]!; const mine = shapeOf[topic]!;
    const others = skills.filter((x) => x !== topic); const o1 = shapeOf[others[i % Math.max(1, others.length)] ?? topic]!; const o2 = shapeOf[others[(i + 1) % Math.max(1, others.length)] ?? topic]!;
    const req: Shape[] = band === 1 ? [mine, mine] : band === 2 ? [mine, o1, mine] : [mine, o1, o2, mine];
    const range = RANGES[band]; const reward = range[0] + rng.int(range[1] - range[0] + 1);
    out.push({ id: `v${i + 1}`, door: doors[i % doors.length]!, variant: Math.floor(i / doors.length), topic, band, req, reward, range, opened: false, claim: null });
  }
  return out;
}
const countOf = (frags: Record<string, number>, shape: string) => frags[shape] ?? 0;
/** Can this team pay for these shapes? Stars are wildcards for band ≤ 2 doors only. Returns the exact payment or null. */
export function payment(frags: Record<string, number>, req: Shape[], band: number): Record<string, number> | null {
  const need: Record<string, number> = {}; req.forEach((r) => { need[r] = (need[r] ?? 0) + 1; });
  const pay: Record<string, number> = {}; let stars = band <= 2 ? countOf(frags, 'star') : 0;
  for (const [sh, n] of Object.entries(need)) { const have = Math.min(n, countOf(frags, sh)); pay[sh] = have; let short = n - have; const use = Math.min(short, stars); if (use) { pay.star = (pay.star ?? 0) + use; stars -= use; short -= use; } if (short > 0) return null; }
  return pay;
}
export const scoreOf = (t: VaultTeam) => t.held + t.banked;

function onAnswer(s: GameState<VaultG>, a: VerifiedAnswer, ask: AskInfo) {
  const { g, core: c } = s; const t = g.teams[a.teamId]!;
  if (ask.purpose === 'practice') {
    if (a.grade === 'correct') { t.frags.star = (t.frags.star ?? 0) + 1; log(c, 'practiceStar', a.teamId); fx(c, 'frag', a.teamId, 'star'); g.last = { team: a.teamId, frags: 1, shape: 'star' }; }
    else { log(c, 'practiceMiss', a.teamId); fx(c, 'miss', a.teamId); g.last = { team: a.teamId, frags: 0, shape: null }; }
    if (ask.ref) t.practiced.push(ask.ref); return;
  }
  const shape = shapeOfSkill(g, ask.topic ?? g.skill); const n = a.grade === 'correct' ? 2 : a.grade === 'partial' ? 1 : 0;
  if (n > 0) { t.frags[shape] = (t.frags[shape] ?? 0) + n; log(c, `frag_${a.grade}`, a.teamId, { n }); fx(c, 'frag', a.teamId, shape); }
  else { log(c, 'miss', a.teamId); fx(c, 'miss', a.teamId); }
  g.last = { team: a.teamId, frags: n, shape: n ? shape : null };
}
function afterAsk(s: GameState<VaultG>) {
  const { core: c, g } = s; const a = c.ask!;
  const wrong = a.teamIds.some((id) => g.teams[id] && c.evidence.find((e) => e.team === id && e.pos === a.position)?.grade === 'wrong');
  c.phase = wrong ? 'review' : 'planning';
}
function askSpec(s: GameState<VaultG>, p: Record<string, unknown>) {
  const { g, core: c } = s; const team = actorTeam(c).id;
  if (p.practice === true) {
    if (c.phase !== 'review') return err('practiceAfterMiss');
    const v = g.vaults.find((x) => x.id === g.selected); const ref = v?.id ?? 'general';
    if (g.teams[team]!.practiced.includes(ref)) return err('practiceUsed');
    return { teamIds: [team], topic: v?.topic ?? null, difficulty: 1 as Difficulty, purpose: 'practice', ref };
  }
  if (c.phase !== 'choose' && c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
  const v = g.vaults.find((x) => x.id === g.selected); if (!v) return err('chooseVault'); if (v.opened) return err('vaultOpen');
  const skill = typeof p.skill === 'string' && g.skills.includes(p.skill) ? p.skill : v.topic;
  g.skill = skill;
  return { teamIds: askTeams(c), topic: skill, difficulty: v.band as Difficulty, purpose: 'vault', ref: v.id };
}

function command(s: GameState<VaultG>, cmd: GameCommand, _env: Env): ReduceResult {
  const { g, core: c } = s; const p = (cmd.payload ?? {}) as Record<string, unknown>;
  const team = typeof p.team === 'string' ? p.team : actorTeam(c).id; const t = g.teams[team];
  const free = c.phase === 'choose' || c.phase === 'planning';
  switch (cmd.action) {
    case 'choose_vault': { if (!free) return err('wrongPhase', { phase: c.phase }); const v = g.vaults.find((x) => x.id === p.vault); if (!v) return err('badVault'); if (v.opened) return err('vaultOpen'); g.selected = v.id; log(c, 'chooseVault', actorTeam(c).id, { vault: v.id }); fx(c, 'select', actorTeam(c).id, v.id); return { ok: true, state: s }; }
    case 'cancel_choice': { if (!free || !g.selected) return err('nothingToUndo'); g.selected = null; log(c, 'undo'); return { ok: true, state: s }; }
    case 'open': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
      const v = g.vaults.find((x) => x.id === (p.vault ?? g.selected)); if (!v) return err('badVault'); if (v.opened) return err('vaultOpen');
      const pay = payment(t.frags, v.req, v.band); if (!pay) return err('missingKeys');
      for (const [sh, n] of Object.entries(pay)) t.frags[sh] = (t.frags[sh] ?? 0) - n;
      v.opened = true; v.claim = team; t.opened.push(v.id); t.held += v.reward; g.selected = null; log(c, 'vaultOpened', team, { vault: v.id, reward: v.reward }); fx(c, 'open', team, v.id); return { ok: true, state: s };
    }
    case 'bank': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
      if (t.held <= 0) return err('nothingToBank');
      if (p.mode === 'scanner') { if (t.held < SCANNER_COST) return err('scannerCost', { cost: SCANNER_COST }); t.held -= SCANNER_COST; t.scanner++; log(c, 'scannerBought', team); fx(c, 'scanner', team); }
      else { t.banked += t.held; log(c, 'banked', team, { pts: t.held }); t.held = 0; fx(c, 'bank', team); }
      return { ok: true, state: s };
    }
    case 'scan': {
      if (!t || t.scanner <= 0) return err('noScanner'); if (!free) return err('wrongPhase', { phase: c.phase });
      // information only: the skill where this team's verified answers are weakest (needs at least one attempt)
      const rows = g.skills.map((sk) => { const ev = c.evidence.filter((e) => e.team === team && e.topic === sk); return { sk, n: ev.length, ok: ev.filter((e) => e.grade === 'correct').length }; }).filter((r) => r.n > 0);
      rows.sort((a, b) => a.ok / a.n - b.ok / b.n); t.scanner--; g.lastScan = { team, skill: rows[0]?.sk ?? null }; log(c, 'scanned', team); fx(c, 'scan', team); return { ok: true, state: s };
    }
    case 'share': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!g.checkpoint) return err('checkpointClosed');
      const to = g.teams[String(p.to)]; const shape = String(p.shape ?? '');
      if (!t || !to || p.to === team) return err('badTeam'); if ((t.frags[shape] ?? 0) <= 0) return err('noFragment');
      t.frags[shape]!--; to.frags[shape] = (to.frags[shape] ?? 0) + 1; t.shares++; g.collab++; log(c, 'shared', team, { to: c.teams.find((x) => x.id === p.to)?.name ?? '' }); fx(c, 'share', team); return { ok: true, state: s };
    }
    case 'open_grand': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!t) return err('badTeam'); if (g.grand.opened) return err('vaultOpen');
      if (g.vaults.filter((v) => v.opened).length < g.grand.need) return err('grandLocked', { need: g.grand.need });
      const kinds = SHAPES.filter((sh) => sh !== 'star' && (t.frags[sh] ?? 0) > 0); const required = Math.min(3, Math.max(1, new Set(Object.values(g.skillShape)).size));
      if (kinds.length < required) return err('missingKeys');
      kinds.slice(0, required).forEach((sh) => { t.frags[sh]!--; });
      g.grand.opened = true; g.grand.claim = team; t.held += g.grand.reward; log(c, 'grandOpened', team, { reward: g.grand.reward }); fx(c, 'grand', team); finish(s, 'objective'); return { ok: true, state: s };
    }
    case 'continue': { if (c.phase !== 'review' && c.phase !== 'planning') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    case 'end_turn': { if (c.phase !== 'planning' && c.phase !== 'choose') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    default: return err('unknownAction');
  }
}
function standings(s: GameState<VaultG>): Standing[] {
  const { g, core: c } = s;
  return c.teams.map((t) => { const x = g.teams[t.id]!; return { team: t.id, score: scoreOf(x), rank: 0, detail: { opened: x.opened.length, banked: x.banked, shares: x.shares } }; });
}
const mod: GameModule<VaultG> = {
  key: 'treasure_vault',
  init(core, a: InitArgs) {
    const plan = a.plan;
    let skills = [...new Set(a.pool.filter((p) => p.repeatOf === null && p.topic).map((p) => p.topic!))].slice(0, 5);
    if (skills.length < 2) { const kinds = [...new Set(a.pool.filter((p) => p.repeatOf === null).map((p) => p.kind))]; if (kinds.length >= 2) skills = kinds; else if (!skills.length) skills = ['general']; }
    const skillShape: Record<string, Shape> = {}; skills.forEach((sk, i) => { skillShape[sk] = SHAPES[i % 5]!; });
    const teams: Record<string, VaultTeam> = {}; a.teams.forEach((t) => { teams[t.id] = { frags: {}, held: 0, banked: 0, opened: [], scanner: 0, practiced: [], shares: 0 }; });
    const rng = rngFrom(`${a.seed}:grand`); const vaults = makeVaults(plan.vaults, skills, a.seed, skillShape); void core;
    return { vaults, skills, skillShape, teams, selected: null, skill: null, grand: { reward: 30 + rng.int(6), range: [30, 35], need: Math.max(1, Math.ceil(plan.vaults / 2)), opened: false, claim: null }, checkpoint: false, collab: 0, lastScan: null, last: null, singleSkill: skills.length < 2 };
  },
  askSpec: askSpec as GameModule<VaultG>['askSpec'], onAnswer, afterAsk, command, standings,
  outcome(s, reason) { return reason === 'objective' ? 'grand' : s.g.vaults.every((v) => v.opened) ? 'allOpen' : 'timeUp'; },
  checkEnd(s) { return s.g.vaults.every((v) => v.opened) && s.g.grand.opened ? 'objective' : null; },
  onTurnStart(s) { s.g.checkpoint = s.core.round % 2 === 0; },
};
registerGame(mod as unknown as GameModule);
export default mod;
