/** Points are the only match currency. All functions are pure: they take trusted, server-computed inputs and return new numbers.
 *  The client never supplies a fraction, a price, a wallet or a winner. */
import type { Config, Draft, Participant, Role, Team, TeamResult, UpgradeKind } from './domain';
import { UPGRADES } from './domain';
import { ECONOMY, ROLE_PRIORITY, UPGRADE_DEFS, upgradeCost } from './balance';
import { Stream, seedFrom } from './rng';

const bound = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** Team points for one question: all-correct earns one base award regardless of team size (team-size normalization). */
export function teamAward(fractions: number[], eligibleCount: number, base: number = ECONOMY.baseAward): number {
  if (eligibleCount <= 0) return 0;
  if (!Number.isFinite(base) || base < 0 || base > 100) throw new Error('bad award base');
  const sum = fractions.reduce((a, f) => a + bound(Number.isFinite(f) ? f : 0, 0, 1), 0);
  return Math.min(base, Math.round((base * sum) / eligibleCount));
}

export function legalUpgrades(t: Pick<Team, 'upgrades'>): UpgradeKind[] { return UPGRADES.filter((u) => (t.upgrades[u] ?? 0) < UPGRADE_DEFS[u].maxLevel); }
/** Same seed ⇒ same draft order for every team; legality (max level) is the only per-team adjustment. One damage and one utility offer when legal. */
export function draftOffers(seed: number, draftIndex: number, t: Pick<Team, 'upgrades'>): UpgradeKind[] {
  const s = new Stream(seedFrom(`${seed}|draft${draftIndex}`));
  const order = [...UPGRADES]; for (let i = order.length - 1; i > 0; i--) { const j = s.int(i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const legal = order.filter((u) => legalUpgrades(t).includes(u));
  const pickBy = (cat: string) => legal.find((u) => UPGRADE_DEFS[u].category === cat);
  const out: UpgradeKind[] = [];
  const atk = pickBy('attack'); if (atk) out.push(atk);
  const uti = pickBy('utility'); if (uti && !out.includes(uti)) out.push(uti);
  for (const u of legal) { if (out.length >= 3) break; if (!out.includes(u)) out.push(u); }
  return out.slice(0, 3);
}
export type Tally = { upgrade: UpgradeKind | null; how: 'vote' | 'default' | 'none'; detail: string };
/** Majority of eligible voters; ties go to the option whose voters hold the highest-priority role, then to a seeded pick. All of it is logged in `detail`. */
export function resolveVotes(a: { seed: number; draftIndex: number; teamId: string; offers: UpgradeKind[]; wallet: number; upgrades: Team['upgrades']; votes: Record<string, UpgradeKind>; voters: Record<string, Role> }): Tally {
  const affordable = (u: UpgradeKind) => upgradeCost(u, a.upgrades[u] ?? 0) <= a.wallet;
  const counts = new Map<UpgradeKind, string[]>();
  for (const [pid, u] of Object.entries(a.votes)) { if (!(pid in a.voters) || !a.offers.includes(u) || !affordable(u)) continue; counts.set(u, [...(counts.get(u) ?? []), pid]); }
  if (counts.size === 0) {
    const d = a.offers.find(affordable);
    return d ? { upgrade: d, how: 'default', detail: `no votes: first affordable offer ${d}` } : { upgrade: null, how: 'none', detail: 'no votes and nothing affordable: nothing charged' };
  }
  const best = Math.max(...[...counts.values()].map((v) => v.length));
  let tied = [...counts.entries()].filter(([, v]) => v.length === best).map(([u]) => u);
  let detail = `majority ${best} vote(s)`;
  if (tied.length > 1) {
    const rank = (u: UpgradeKind) => Math.min(...counts.get(u)!.map((pid) => ROLE_PRIORITY.indexOf(a.voters[pid]!)));
    const bestRank = Math.min(...tied.map(rank)); tied = tied.filter((u) => rank(u) === bestRank); detail = `tie broken by role priority (${ROLE_PRIORITY[bestRank]})`;
    if (tied.length > 1) { const s = new Stream(seedFrom(`${a.seed}|tie${a.draftIndex}|${a.teamId}`)); tied.sort(); const pick = tied[s.int(tied.length)]!; detail += `, then seeded pick ${pick}`; tied = [pick]; }
  }
  return { upgrade: tied[0]!, how: 'vote', detail };
}
/** Atomic in the sense that matters: debit and level change happen together or not at all; a second call for the same (draft, team) throws. */
export function buyUpgrade(team: Team, draft: Draft, teamId: string, upgrade: UpgradeKind): { cost: number; walletBefore: number; walletAfter: number } {
  if (draft.resolved[teamId]) throw new Error('already resolved');
  if (!draft.offers[teamId]?.includes(upgrade)) throw new Error('not offered');
  const cost = upgradeCost(upgrade, team.upgrades[upgrade] ?? 0);
  if (!Number.isFinite(cost) || team.wallet < cost) throw new Error('insufficient points or max level');
  const walletBefore = team.wallet; team.wallet -= cost; team.spent += cost; team.upgrades[upgrade] = (team.upgrades[upgrade] ?? 0) + 1; team.purchases++;
  return { cost, walletBefore, walletAfter: team.wallet };
}

export type RankInput = { team: Team; players: Participant[]; beaconPct: number; dmg: number; activeSec: number; fallenAt: number | null };
/** Versus ranking: waves completed → normalized beacon health → damage per active player-second → team accuracy; ties within tolerance share a rank. */
export function rankTeams(inputs: RankInput[], cfg: Pick<Config, 'mode'>, won: boolean): TeamResult[] {
  const rows = inputs.map((r) => {
    const answered = r.team.eligibleSum; const accuracy = answered > 0 ? Math.round((1000 * r.team.fracSum) / answered) / 10 : null;
    return { r, accuracy, dps: r.activeSec > 0 ? r.dmg / r.activeSec : 0 };
  });
  rows.sort((p, q) => q.r.team.wavesCompleted - p.r.team.wavesCompleted || q.r.beaconPct - p.r.beaconPct || q.dps - p.dps || (q.accuracy ?? -1) - (p.accuracy ?? -1) || p.r.team.id.localeCompare(q.r.team.id));
  const same = (p: (typeof rows)[number], q: (typeof rows)[number]) => p.r.team.wavesCompleted === q.r.team.wavesCompleted && Math.abs(p.r.beaconPct - q.r.beaconPct) < 0.5 && Math.abs(p.dps - q.dps) <= 0.01 * Math.max(p.dps, q.dps, 1e-9) && Math.abs((p.accuracy ?? 0) - (q.accuracy ?? 0)) < 0.5;
  let rank = 0;
  return rows.map((row, i) => {
    if (i === 0 || !same(rows[i - 1]!, row)) rank = i + 1;
    const t = row.r.team;
    return { teamId: t.id, name: t.name, rank, outcome: cfg.mode === 'coop' ? (won ? 'won' : 'lost') : 'finished', wavesCompleted: t.wavesCompleted, beaconPct: Math.round(row.r.beaconPct), dmgPerActiveSec: Math.round(row.dps * 10) / 10, accuracyPct: row.accuracy, earned: t.earned, spent: t.spent, players: row.r.players.length, fellAtWave: row.r.fallenAt };
  });
}
