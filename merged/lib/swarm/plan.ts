/** Session length is a budget: it sets waves, question windows, drafts and bosses (not just speed). Honest about what the quiz can fill. */
import type { BossKind, Config, EnemyKind, Focus, Plan, PlanWave } from './domain';
import { TUNE, ECONOMY, ENEMY_DEFS, ENEMY_UNLOCK_ORDER, QUESTION_SECONDS, FOCUS_Q_MULT, DIFFICULTY } from './balance';
import { TICK_HZ } from './domain';

/** minutes → [waves, question windows, drafts, combat minutes]. Rows are the design table; other lengths interpolate. */
const TABLE: [number, number, number, number, number][] = [[5, 3, 3, 1, 2], [10, 6, 6, 2, 4], [15, 8, 10, 3, 6], [20, 10, 13, 4, 8], [30, 13, 20, 6, 12], [45, 20, 28, 8, 19]];
function row(minutes: number) {
  const m = Math.min(45, Math.max(5, minutes));
  for (let i = 0; i < TABLE.length - 1; i++) {
    const a = TABLE[i]!, b = TABLE[i + 1]!;
    if (m >= a[0] && m <= b[0]) { const t = (m - a[0]) / (b[0] - a[0]); const l = (k: number) => a[k]! + (b[k]! - a[k]!) * t; return { waves: Math.round(l(1)), q: Math.round(l(2)), drafts: Math.round(l(3)), combat: l(4) }; }
  }
  const last = TABLE[TABLE.length - 1]!; return { waves: last[1], q: last[2], drafts: last[3], combat: last[4] };
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type PlanInput = { minutes: number; poolSize: number; focus: Focus; difficulty: Config['difficulty']; allowReviewCycle: boolean; kinds?: string[] };
/** Where the bosses stand, by session length (fractions of the wave list; the last wave is always a boss). */
function bossSchedule(minutes: number, waves: number): Map<number, { kind: BossKind; mini: boolean; final: boolean }> {
  const at = (f: number) => Math.max(2, Math.min(waves - 1, Math.round(waves * f)));
  const m = new Map<number, { kind: BossKind; mini: boolean; final: boolean }>();
  if (minutes < 15) { m.set(waves, { kind: 'marrow_drum', mini: minutes <= 5, final: true }); return m; }
  if (minutes < 30) { m.set(at(0.55), { kind: 'glass_heron', mini: minutes < 20, final: false }); m.set(waves, { kind: 'marrow_drum', mini: false, final: true }); return m; }
  m.set(at(0.35), { kind: 'marrow_drum', mini: false, final: false }); m.set(at(0.68), { kind: 'glass_heron', mini: false, final: false }); m.set(waves, { kind: 'orchard_engine', mini: false, final: true });
  return m;
}
export function questionSecondsFor(kind: string, focus: Focus, override: number | null): number {
  if (override) return override;
  return Math.round((QUESTION_SECONDS[kind] ?? 40) * FOCUS_Q_MULT[focus]);
}
export function planSession(inp: PlanInput): Plan {
  const warnings: string[] = [];
  const r = row(inp.minutes);
  let waves = r.waves, q = r.q, reviewCycle = false;
  const pool = Math.max(0, Math.floor(inp.poolSize));
  if (pool < q) {
    if (inp.allowReviewCycle && pool >= 3) { reviewCycle = true; warnings.push(`Your quiz has ${pool} questions; a ${inp.minutes}-minute session wants about ${q}. One clearly labelled review cycle will repeat questions (teacher-approved).`); }
    else { q = pool; warnings.push(`Your quiz has ${pool} question${pool === 1 ? '' : 's'}; a ${inp.minutes}-minute session wants about ${r.q}. The session was shortened instead of inventing questions. Add questions, shorten the length, or allow one review cycle.`); }
  }
  q = Math.max(0, q);
  // every break needs at least one question; a break holds at most two
  waves = Math.max(2, Math.min(waves, q + 1));
  const breaks = waves - 1;
  if (q > breaks * 2) q = breaks * 2;
  const perBreak = Array.from({ length: breaks }, (_, i) => (i < q - breaks ? 2 : 1));
  const sum = perBreak.reduce((a, b) => a + b, 0);
  const questionsTotal = Math.min(q, sum);
  const draftsWanted = clamp(Math.round((r.drafts * breaks) / Math.max(1, r.waves - 1)), breaks >= 2 ? 1 : 0, breaks);
  const draftBreaks = new Set<number>();
  if (draftsWanted > 0) for (let i = 1; i <= draftsWanted; i++) draftBreaks.add(Math.min(breaks, Math.max(1, Math.round((i * breaks) / draftsWanted))));
  const bosses = bossSchedule(inp.minutes, waves);
  const waveSecs = clamp((r.combat * 60) / waves, 25, 70);
  const diff = DIFFICULTY[inp.difficulty];
  const unlocked = (n: number) => Math.min(ENEMY_UNLOCK_ORDER.length, n);
  const patterns: PlanWave['pattern'][] = ['stream', 'ring', 'flank', 'surround'];
  const out: PlanWave[] = [];
  for (let n = 1; n <= waves; n++) {
    const progress = n / waves;
    const boss = bosses.get(n) ?? null;
    const budget = (n === 1 ? TUNE.b1 : TUNE.b0 + TUNE.bs * (n - 1) * (inp.minutes >= 30 ? 0.8 : 1)) * diff.budget * (boss ? 0.55 : 1);
    const newKind: EnemyKind | null = n <= ENEMY_UNLOCK_ORDER.length && !(boss && n === waves) ? ENEMY_UNLOCK_ORDER[n - 1]! : null;
    const ticksSec = n === 1 ? Math.min(waveSecs, 30) : waveSecs; // gentle, short first wave (tutorial)
    out.push({ n, ticks: Math.round(ticksSec * TICK_HZ), budget: Math.round(budget * 10) / 10, boss, pattern: inp.minutes >= 45 ? patterns[(n - 1) % 4]! : n % 3 === 0 ? 'ring' : n % 4 === 0 ? 'flank' : 'stream', newKind: newKind && unlocked(n) >= n ? newKind : null, questionsAfter: n <= breaks ? perBreak[n - 1]! : 0, draftAfter: n <= breaks && draftBreaks.has(n) });
    void progress;
  }
  const avgQ = (QUESTION_SECONDS.multiple_choice! * 0.4 + QUESTION_SECONDS.answer_forge! * 0.2 + QUESTION_SECONDS.truth_hunt! * 0.15 + QUESTION_SECONDS.connection_rush! * 0.15 + QUESTION_SECONDS.fill_table! * 0.1) * FOCUS_Q_MULT[inp.focus];
  const est = out.reduce((a, w) => a + (w.boss ? Math.max(w.ticks / TICK_HZ, 60) : w.ticks / TICK_HZ), 0)
    + questionsTotal * (avgQ * 0.8 + ECONOMY.grade[inp.focus] + 1) + draftBreaks.size * ECONOMY.draftSeconds + breaks * (ECONOMY.resumeSeconds + 1) + ECONOMY.countdownSeconds + 45;
  const estimateSeconds = Math.round(est);
  if (estimateSeconds > inp.minutes * 60 * 1.25) warnings.push(`This setup will probably run about ${Math.round(estimateSeconds / 60)} minutes (the length is a budget, not a promise).`);
  void ENEMY_DEFS;
  return { minutes: inp.minutes, waves: out, questionsTotal, drafts: draftBreaks.size, estimateSeconds, warnings, reviewCycle };
}
