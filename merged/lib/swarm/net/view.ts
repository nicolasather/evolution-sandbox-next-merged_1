/** Per-viewer redacted views and delta encoding. The view is built ONLY from fields listed here: a new field in the room state cannot leak by accident.
 *  - players: own arena at full detail (+ own personal state). Other teams: name, waves, beacon %, status. Never another team's entities.
 *  - the answer key and explanation exist in a view only after the window is graded (`quiz.revealed`), never before.
 *  - host/screen viewers see one focus arena (default: first team) plus every team summary. */
import { ENEMY_KINDS, BOSS_KINDS, ROLES, isActivePhase, type Room, type Role } from '../domain';
import { publicQuestionView, type StoredQuestion } from '../../quiz/public';
import { upgradeCost, UPGRADE_DEFS } from '../balance';

export type Viewer = { kind: 'player'; pid: string } | { kind: 'host'; focus?: string } | { kind: 'screen'; focus?: string };
export type ViewParts = { s: Record<string, unknown>; e: Record<string, Record<string, number[]>>; fx: unknown[] };
export type Delta = { s?: Record<string, unknown>; e?: Record<string, { set?: Record<string, number[]>; del?: string[] }> };

const r1 = (n: number) => Math.round(n * 10) / 10 + 0; // + 0 turns -0 into 0 so wire values compare cleanly
const rz = (n: number) => Math.round(n) + 0;
const KIND_IDX: Record<string, number> = Object.fromEntries([...ENEMY_KINDS, ...BOSS_KINDS].map((k, i) => [k, i]));
const STATE_IDX: Record<string, number> = { spawn: 0, seek: 1, pre_attack: 2, attack: 3, recover: 4, dead: 5 };
const SRC_IDX: Record<string, number> = { player: 0, turret: 1, drone: 2, hazard: 3 };
const HZ_IDX: Record<string, number> = { arc: 0, ring: 1, beam: 2, root: 3, orb: 4 };
export const ENC = { kinds: [...ENEMY_KINDS, ...BOSS_KINDS], roles: ROLES, hazards: ['arc', 'ring', 'beam', 'root', 'orb'], bullets: ['player', 'turret', 'drone', 'hazard'] } as const;

export type QLookup = (questionId: string) => StoredQuestion | null;
const OFFLINE = 1, DOWN = 2, SHIELD = 4, DASH = 8, PROT = 16, INV = 32, ROOT = 64, SLOW = 128, OUT = 256;

export function teamOfViewer(room: Room, v: Viewer): string | null {
  if (v.kind === 'player') return room.roster[v.pid]?.teamId ?? null;
  const f = v.focus && room.teams[v.focus] ? v.focus : room.teamOrder[0];
  return f ?? null;
}

export function buildView(room: Room, viewer: Viewer, nowMs: number, lookup: QLookup): ViewParts {
  const focus = teamOfViewer(room, viewer);
  const me = viewer.kind === 'player' ? room.roster[viewer.pid] : undefined;
  const q = room.quiz; const d = room.draft;
  const plan = room.plan;
  const pw = room.wave > 0 ? plan.waves[room.wave - 1] : undefined;
  const s: Record<string, unknown> = {};
  s.meta = {
    rev: room.rev, phase: room.phase, paused: room.paused, pauseReason: room.pauseReason, wave: room.wave, waves: plan.waves.length, waveTick: room.waveTick, waveTicks: pw?.ticks ?? 0, boss: pw?.boss?.kind ?? null,
    locked: room.locked, mode: room.config.mode, map: room.config.mapId, code: room.code, phaseEndsMs: room.phaseEndsMs, resumeAtMs: room.resumeAtMs, hostPresent: room.hostPresent,
    teamSizeCap: room.config.teamSizeCap, captainOnly: room.config.captainOnlyDraft, hideNames: viewer.kind === 'screen' && room.config.hideTeamNames, minutes: room.config.minutes, qDone: room.qUsed, qTotal: plan.questionsTotal, draftsDone: room.draftsDone, allowRespec: room.config.allowRespec, lateJoin: room.lateJoin, focus,
  };
  const shown = (t: string, name: string) => (viewer.kind === 'screen' && room.config.hideTeamNames ? `Team ${room.teamOrder.indexOf(t) + 1}` : name);
  s.teams = room.teamOrder.map((t) => {
    const tm = room.teams[t]!; const a = room.arenas[t]; const own = focus === t;
    return { id: t, name: shown(t, tm.name), status: a?.status ?? 'alive', waves: tm.wavesCompleted, beacon: a ? rz((100 * a.beacon.hp) / Math.max(1, a.beacon.max)) : 100, size: Object.values(room.roster).filter((m) => m.teamId === t && !m.forfeited).length,
      ...(own || viewer.kind !== 'player' ? { wallet: tm.wallet, upgrades: tm.upgrades } : {}) };
  });
  s.roster = room.rosterOrder.map((id) => room.roster[id]!).filter((m) => !m.forfeited && (viewer.kind !== 'player' || m.teamId === me?.teamId)).map((m) => ({
    id: m.id, name: m.name, team: m.teamId, role: m.role, on: m.connected, ready: m.ready, cap: m.captain, pend: m.pending,
    ...(q && q.status === 'open' && q.eligible[m.teamId]?.includes(m.id) ? { ans: !!q.answers[m.id] } : {}),
  }));
  if (me) {
    const mine = q?.answers[me.id];
    s.me = { id: me.id, team: me.teamId, role: me.role, ready: me.ready, cap: me.captain, seq: me.seq, answered: !!mine, ...(q?.revealed && mine ? { result: { frac: mine.frac, correct: mine.correct } } : {}) };
  }
  if (q && (room.phase === 'question' || q.revealed)) {
    const row = lookup(q.questionId); const reveal = q.revealed;
    s.quiz = {
      w: q.id, index: q.index, total: plan.questionsTotal, status: q.status, openedMs: q.openedMs, deadlineMs: q.deadlineMs, extensions: q.extensions, paused: room.paused, reveal,
      question: row ? publicQuestionView(row, { reveal, seed: `${room.id}:${q.id}` }) : null,
      eligibleTotal: focus ? (q.eligible[focus] ?? []).length : 0, answeredTotal: focus ? (q.eligible[focus] ?? []).filter((x) => q.answers[x]).length : 0,
      ...(reveal && focus ? { awarded: room.events.filter((e) => e.k === 'award' && e.team === focus && e.a?.q === q.id).map((e) => e.a?.award)[0] ?? null } : {}),
    };
  }
  if (d && focus && (room.phase === 'upgrade' || d.resolved[focus])) {
    const offers = d.offers[focus] ?? []; const tm = room.teams[focus]!; const votes = d.votes[focus] ?? {};
    const count: Record<string, number> = {}; for (const u of Object.values(votes)) count[u] = (count[u] ?? 0) + 1;
    s.draft = {
      id: d.id, index: d.index, closesMs: d.closesMs, paused: room.paused, resolved: d.resolved[focus] ?? null,
      offers: offers.map((u) => ({ id: u, level: tm.upgrades[u] ?? 0, cost: upgradeCost(u, tm.upgrades[u] ?? 0), max: UPGRADE_DEFS[u].maxLevel, affordable: upgradeCost(u, tm.upgrades[u] ?? 0) <= tm.wallet, votes: count[u] ?? 0 })),
      myVote: me ? votes[me.id] ?? null : null,
    };
  }
  if (room.results) s.results = { ...room.results, standings: room.results.standings.map((x) => ({ ...x, name: shown(x.teamId, x.name) })), phase: room.phase };
  const e: ViewParts['e'] = { p: {}, e: {}, b: {}, h: {}, t: {}, d: {} };
  const fx: unknown[] = [];
  const a = focus ? room.arenas[focus] : undefined;
  if (a && room.phase !== 'lobby') {
    s.arena = { team: a.teamId, status: a.status, beacon: { hp: rz(a.beacon.hp), max: a.beacon.max, shield: rz(a.beacon.shield), shieldOn: a.beacon.shieldTicks > 0 }, kills: a.kills, active: isActivePhase(room.phase) && !room.paused, w: a.waveTick, wt: a.waveTicks };
    for (const [pid, p] of Object.entries(a.players)) {
      const m = room.roster[pid]; const f = (m && !m.connected ? OFFLINE : 0) | (p.down ? DOWN : 0) | (p.shieldTicks > 0 ? SHIELD : 0) | (p.dashTicks > 0 ? DASH : 0) | (p.protectTicks > 0 ? PROT : 0) | (p.invuln > 0 ? INV : 0) | (p.rootTicks > 0 ? ROOT : 0) | (p.slowTicks > 0 ? SLOW : 0) | (p.outWave ? OUT : 0);
      e.p![pid] = [r1(p.x), r1(p.y), rz(p.hp), p.maxHp, rz(p.face * 100), f, ROLES.indexOf((m?.role ?? 'scout') as Role), rz(p.shield), p.abilityCd, p.abilityMax, p.downTicks, p.reviveTicks];
    }
    for (const en of a.enemies) if (en.state !== 'dead') e.e![String(en.id)] = [KIND_IDX[en.kind]!, r1(en.x), r1(en.y), rz(en.hp), en.maxHp, STATE_IDX[en.state]!, rz(en.face * 100), en.radius, en.phase, en.st];
    for (const b of a.bullets) e.b![String(b.id)] = [r1(b.x), r1(b.y), SRC_IDX[b.src]!, b.r, r1(b.vx), r1(b.vy)];
    for (const h of a.hazards) e.h![String(h.id)] = [HZ_IDX[h.kind]!, r1(h.x), r1(h.y), rz(h.a0 * 1000), rz(h.a1 * 1000), rz(h.w * 1000), r1(h.r0), r1(h.r1), rz(h.gapA * 1000), rz(h.gapW * 1000), h.telegraph, h.telegraphMax, h.active, h.activeMax, h.t];
    for (const t of a.turrets) e.t![String(t.id)] = [r1(t.x), r1(t.y), t.ttl];
    a.drones.forEach((dr) => { e.d![String(dr.id)] = [r1(dr.x), r1(dr.y)]; });
  }
  void nowMs;
  return { s, e, fx };
}

const same = (a: number[] | undefined, b: number[]) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);
export function diffViews(prev: ViewParts | null, next: ViewParts): { full: boolean; delta: Delta } {
  if (!prev) return { full: true, delta: { s: next.s, e: Object.fromEntries(Object.entries(next.e).map(([k, v]) => [k, { set: v }])) } };
  const out: Delta = {};
  for (const [k, v] of Object.entries(next.s)) { const pj = prev.s[k]; if (pj === undefined || JSON.stringify(pj) !== JSON.stringify(v)) (out.s ??= {})[k] = v; }
  for (const k of Object.keys(prev.s)) if (!(k in next.s)) (out.s ??= {})[k] = null;
  for (const g of Object.keys(next.e)) {
    const set: Record<string, number[]> = {}; const del: string[] = []; const pg = prev.e[g] ?? {}; const ng = next.e[g]!;
    for (const [id, arr] of Object.entries(ng)) if (!same(pg[id], arr)) set[id] = arr;
    for (const id of Object.keys(pg)) if (!(id in ng)) del.push(id);
    if (Object.keys(set).length || del.length) (out.e ??= {})[g] = { ...(Object.keys(set).length ? { set } : {}), ...(del.length ? { del } : {}) };
  }
  return { full: false, delta: out };
}
/** Client-side (and test) application of a delta; exported here so server and client share one definition of the format. */
export function applyDelta(state: ViewParts, d: Delta, full: boolean): ViewParts {
  const base: ViewParts = full ? { s: {}, e: { p: {}, e: {}, b: {}, h: {}, t: {}, d: {} }, fx: [] } : { s: { ...state.s }, e: Object.fromEntries(Object.entries(state.e).map(([k, v]) => [k, { ...v }])), fx: [] };
  for (const [k, v] of Object.entries(d.s ?? {})) { if (v === null) delete base.s[k]; else base.s[k] = v; }
  for (const [g, c] of Object.entries(d.e ?? {})) { const t = (base.e[g] ??= {}); for (const id of c.del ?? []) delete t[id]; for (const [id, arr] of Object.entries(c.set ?? {})) t[id] = arr; }
  return base;
}
