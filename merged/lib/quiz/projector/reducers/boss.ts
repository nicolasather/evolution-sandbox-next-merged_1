/** BOSS BATTLE — cooperative raid. Every effect is the consequence of a VERIFIED answer; the boss answers back on a telegraph. */
import { err, type AskInfo, type BossId, type Core, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, fx, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';
import { BOSSES, type TelegraphKind } from '../content/bosses';
import { rngFrom } from '../rng';

export type BossAction = 'strike' | 'defend' | 'repair' | 'scan' | 'combine';
export type Role = 'attack' | 'support' | 'defense';
export type BossTeam = { role: Role; chosen: BossAction | null; aim: 'weak' | 'any'; partner: string | null; cd: { scan: number; combine: number }; synergy: string[]; dealt: number; shielded: number; healed: number; hits: number };
export type BossG = {
  boss: { id: BossId; hp: number; maxHp: number; phase: 1 | 2 | 3; phases: 1 | 2 | 3; armor: number; armorMax: number; barrier: number; barrierMax: number; exposed: boolean; weakTopic: string | null; telegraph: { kind: TelegraphKind; topic: string | null }; surge: boolean };
  shared: { shield: number; hp: number; hpMax: number; research: number };
  teams: Record<string, BossTeam>; topics: string[]; phaseFired: number[]; bossActs: number;
  last: { team: string; action: BossAction; amount: number; weak: boolean; pierced: boolean; grade: string } | null;
  dmgLog: { team: string; amount: number }[];
};
export const SHIELD_CAP = 12;
export const CLASS_HP = 10;
const BASE = { strike: 10, weakBonus: 5, defend: 8, repair: 5, combine: 25 };

/** HP is derived from the assessed-question budget so a class of ordinary accuracy can win in the time chosen. */
export function bossMaxHp(turnBudget: number, phases: 1 | 2 | 3 = 1): number { return Math.max(24, Math.round(turnBudget * 5.5 * (phases === 3 ? 1.5 : phases === 2 ? 1.12 : 1))); }
const frac = (a: VerifiedAnswer) => (a.grade === 'correct' ? 1 : a.grade === 'partial' ? 0.5 : 0);

function nextTelegraph(g: BossG, topics: string[]): { kind: TelegraphKind; topic: string | null } {
  const def = BOSSES[g.boss.id]; const seq = def.moves[g.boss.phase - 1]!; const kind = seq[g.bossActs % seq.length]!;
  return { kind, topic: kind === 'weakness' ? (topics.length ? topics[(g.bossActs + g.boss.phase) % topics.length]! : null) : null };
}
function enterPhase(g: BossG, phase: 2 | 3) {
  g.boss.phase = phase; g.phaseFired.push(phase);
  if (phase === 2) { g.boss.armor = 0; g.boss.barrierMax = 8; g.boss.barrier = 8; } else { g.boss.barrier = 0; g.boss.armor = 0; g.boss.exposed = true; }
  g.boss.telegraph = nextTelegraph(g, g.topics);
}
function checkPhase(s: GameState<BossG>) {
  const { g, core: c } = s; const b = g.boss;
  const th = b.phases === 2 ? [0.5] : b.phases === 3 ? [2 / 3, 1 / 3] : [];
  for (let i = 0; i < th.length; i++) {
    const want = (i + 2) as 2 | 3;
    if (b.phase < want && !g.phaseFired.includes(want) && b.hp <= Math.floor(b.maxHp * th[i]!)) { enterPhase(g, want); log(c, 'bossPhase', undefined, { phase: want }); fx(c, 'phase', undefined, want); }
  }
}

function onAnswer(s: GameState<BossG>, a: VerifiedAnswer, ask: AskInfo) {
  const { core: c, g } = s; const t = g.teams[a.teamId]!; const f = frac(a); const action = t.chosen ?? 'strike'; const b = g.boss;
  let amount = 0, weak = false, pierced = false;
  if (f === 0) {
    if (!c.lowPressure && g.shared.hp > 0) { const soak = Math.min(g.shared.shield, 1); g.shared.shield -= soak; if (!soak) g.shared.hp = Math.max(0, g.shared.hp - 1); }
    log(c, 'miss', a.teamId); fx(c, 'miss', a.teamId);
  } else if (action === 'strike' || action === 'combine') {
    const combo = action === 'combine';
    weak = !combo && !!a.topic && a.topic === b.weakTopic;
    let dmg = combo ? BASE.combine : BASE.strike + (weak ? BASE.weakBonus : 0) + (t.role === 'attack' ? 2 : 0);
    dmg = Math.round(dmg * f);
    if (!combo) {
      if (b.phase === 1 && b.armor > 0 && !b.exposed) { dmg = Math.ceil(dmg * 0.5); b.armor--; }
      else if (b.phase === 2 && b.barrier > 0 && !b.exposed) { const ab = Math.min(b.barrier, dmg); b.barrier -= ab; dmg -= ab; }
      else if (b.exposed) pierced = true;
      if (b.phase === 3) dmg = Math.ceil(dmg * 1.25);
    } else pierced = true;
    if (b.exposed && b.phase !== 3) b.exposed = false;
    b.hp = Math.max(0, b.hp - dmg); amount = dmg; t.dealt += dmg; t.hits++; g.dmgLog.push({ team: a.teamId, amount: dmg }); if (g.dmgLog.length > 30) g.dmgLog.shift();
    if (combo) { const partner = g.teams[t.partner ?? '']; if (partner) { partner.synergy.shift(); t.synergy.shift(); t.cd.combine = 2; } }
    else if (f === 1) { t.synergy.push(a.topic ?? `kind:${a.kind}`); if (t.synergy.length > 2) t.synergy.shift(); }
    log(c, combo ? 'combo' : 'strike', a.teamId, { amount, weak: weak ? 1 : 0 }); fx(c, combo ? 'combo' : 'strike', a.teamId, amount);
    checkPhase(s);
  } else if (action === 'defend') {
    amount = Math.round((BASE.defend + (t.role === 'defense' ? 2 : 0)) * f); g.shared.shield = Math.min(SHIELD_CAP, g.shared.shield + amount); t.shielded += amount;
    if (f === 1) { t.synergy.push(a.topic ?? `kind:${a.kind}`); if (t.synergy.length > 2) t.synergy.shift(); }
    log(c, 'defend', a.teamId, { amount }); fx(c, 'defend', a.teamId, amount);
  } else if (action === 'repair') {
    amount = Math.round((BASE.repair + (t.role === 'support' ? 2 : 0)) * f); const before = g.shared.hp; g.shared.hp = Math.min(g.shared.hpMax, g.shared.hp + amount); t.healed += g.shared.hp - before;
    log(c, 'repair', a.teamId, { amount: g.shared.hp - before }); fx(c, 'repair', a.teamId, g.shared.hp - before);
  } else if (action === 'scan') {
    if (g.topics.length) { const i = g.topics.indexOf(b.weakTopic ?? ''); b.weakTopic = g.topics[(i + 1) % g.topics.length]!; }
    g.shared.research += t.role === 'support' ? 2 : 1; b.exposed = true; t.cd.scan = 2; log(c, 'scan', a.teamId); fx(c, 'scan', a.teamId);
  }
  g.last = { team: a.teamId, action, amount, weak, pierced, grade: a.grade };
  t.chosen = null; t.partner = null; t.aim = 'any'; void ask;
}
function afterAsk(s: GameState<BossG>) { const { core: c } = s; c.phase = c.ask?.answered.some((id) => c.evidence.find((e) => e.team === id && e.pos === c.ask!.position)?.grade === 'wrong') ? 'review' : 'resolution'; }

function bossAct(s: GameState<BossG>) {
  const { core: c, g } = s; const b = g.boss; const tg = b.telegraph;
  if (tg.kind === 'attack') {
    const raw = (b.phase + 1) * (b.surge ? 2 : 1); b.surge = false;
    if (!c.lowPressure) { const soak = Math.min(g.shared.shield, raw); g.shared.shield -= soak; g.shared.hp = Math.max(0, g.shared.hp - (raw - soak)); log(c, 'bossAttack', undefined, { dmg: raw, soaked: soak }); } else log(c, 'bossAttackSoft');
    fx(c, 'bossAttack');
  } else if (tg.kind === 'surge') { b.surge = true; log(c, 'bossSurge'); fx(c, 'bossSurge'); }
  else if (tg.kind === 'barrier') { if (b.phase >= 2) b.barrier = Math.min(b.barrierMax || 8, b.barrier + 4); else b.armor = Math.min(b.armorMax, b.armor + 1); log(c, 'bossBarrier'); fx(c, 'bossBarrier'); }
  else { b.exposed = true; if (tg.topic) b.weakTopic = tg.topic; log(c, 'bossWeak', undefined, { }); fx(c, 'bossWeak'); }
  g.bossActs++; for (const t of Object.values(g.teams)) { t.cd.scan = Math.max(0, t.cd.scan - 1); t.cd.combine = Math.max(0, t.cd.combine - 1); }
  b.telegraph = nextTelegraph(g, g.topics);
}

function askSpec(s: GameState<BossG>) {
  const { core: c, g } = s;
  if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
  const ids = askTeams(c);
  if (ids.some((id) => !g.teams[id]!.chosen)) return err('chooseAction');
  const aimWeak = ids.some((id) => g.teams[id]!.chosen === 'strike' && g.teams[id]!.aim === 'weak');
  return { teamIds: ids, topic: aimWeak ? g.boss.weakTopic : null, difficulty: (g.boss.phase) as Difficulty, purpose: 'boss', ref: null };
}

function command(s: GameState<BossG>, cmd: GameCommand, _env: Env): ReduceResult {
  const { core: c, g } = s; const p = (cmd.payload ?? {}) as Record<string, unknown>;
  const team = typeof p.team === 'string' ? p.team : actorTeam(c).id; const t = g.teams[team];
  switch (cmd.action) {
    case 'choose_action': {
      if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
      if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
      const a = p.action as BossAction; if (!['strike', 'defend', 'repair', 'scan', 'combine'].includes(a)) return err('badAction');
      if (a === 'scan' && t.cd.scan > 0) return err('cooldown', { turns: t.cd.scan });
      if (a === 'combine') {
        if (g.boss.phase < 2) return err('combineLocked'); if (t.cd.combine > 0) return err('cooldown', { turns: t.cd.combine });
        const partner = typeof p.partner === 'string' ? g.teams[p.partner] : undefined;
        if (!partner || p.partner === team) return err('badPartner');
        if (!t.synergy.length || !partner.synergy.length) return err('noSynergy');
        if (t.synergy[0] === partner.synergy[0]) return err('sameTopicSynergy');
        t.partner = p.partner as string;
      }
      t.chosen = a; t.aim = p.aim === 'weak' ? 'weak' : 'any'; log(c, 'chose', team, { action: a }); fx(c, 'choose', team); return { ok: true, state: s };
    }
    case 'cancel_choice': { if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase }); if (!t || !t.chosen) return err('nothingToUndo'); t.chosen = null; t.partner = null; log(c, 'undo'); return { ok: true, state: s }; }
    case 'set_role': { if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase }); if (!t) return err('badTeam'); if (!['attack', 'support', 'defense'].includes(String(p.role))) return err('badAction'); t.role = p.role as Role; log(c, 'role', team, { role: String(p.role) }); return { ok: true, state: s }; }
    case 'continue': { if (c.phase !== 'resolution' && c.phase !== 'review') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    default: return err('unknownAction');
  }
}
function standings(s: GameState<BossG>): Standing[] {
  const { g, core: c } = s;
  return c.teams.map((t) => { const x = g.teams[t.id]!; return { team: t.id, score: x.dealt + x.shielded + x.healed, rank: 1, detail: { dealt: x.dealt, shield: x.shielded, repair: x.healed, hits: x.hits } }; });
}
const mod: GameModule<BossG> = {
  key: 'boss_battle',
  init(core, a: InitArgs) {
    const rng = rngFrom(`${a.seed}:boss`); const id = (a.settings.boss ?? rng.pick(Object.keys(BOSSES) as BossId[]));
    const phases = a.plan.bossPhases; const maxHp = bossMaxHp(a.turnBudget, phases);
    const topics = [...new Set(a.pool.filter((p) => p.repeatOf === null && p.topic).map((p) => p.topic!))];
    const roles: Role[] = ['attack', 'support', 'defense'];
    const teams: Record<string, BossTeam> = {}; a.teams.forEach((t, i) => { teams[t.id] = { role: roles[i % 3]!, chosen: null, aim: 'any', partner: null, cd: { scan: 0, combine: 0 }, synergy: [], dealt: 0, shielded: 0, healed: 0, hits: 0 }; });
    const g: BossG = { boss: { id, hp: maxHp, maxHp, phase: 1, phases, armor: 3, armorMax: 3, barrier: 0, barrierMax: 0, exposed: false, weakTopic: topics[0] ?? null, telegraph: { kind: 'attack', topic: null }, surge: false }, shared: { shield: 0, hp: CLASS_HP, hpMax: CLASS_HP, research: 0 }, teams, topics, phaseFired: [], bossActs: 0, last: null, dmgLog: [] };
    g.boss.telegraph = nextTelegraph(g, topics); void core; return g;
  },
  askSpec: askSpec as GameModule<BossG>['askSpec'], onAnswer, afterAsk, command, standings,
  outcome(s, reason) { return s.g.boss.hp <= 0 ? 'victory' : reason === 'defeat' ? 'defeat' : 'unfinished'; },
  checkEnd(s) { if (s.g.boss.hp <= 0) return 'objective'; if (s.g.shared.hp <= 0) return 'defeat'; return null; },
  onTurnStart(s) { const { core: c, g } = s; if (g.bossActs < c.round - 1) { bossAct(s); checkPhase(s); } },
};
registerGame(mod as unknown as GameModule);
export default mod;
export type { Core };
