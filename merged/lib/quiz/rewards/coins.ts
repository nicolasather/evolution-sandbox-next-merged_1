/** Coin wallet: an append-only, idempotent ledger. Coins are COSMETIC-ONLY currency; in-game Points are a separate thing that never touches this file.
 *  This is the pure rule set the server applies. Persisting it is gated (see PERSISTENCE_GATE) and the browser never treats its own copy as authoritative. Pure. */
export type CoinSource = 'daily_learning' | 'weekly_mission' | 'achievement' | 'teacher_milestone' | 'referral' | 'season_grant' | 'purchase' | 'refund' | 'correction';
export type Entry = {
  id: string; at: string; /** local calendar day the server derived from the person's time zone, YYYY-MM-DD */ day: string;
  kind: 'earn' | 'spend' | 'reversal'; source: CoinSource; amount: number; reverses?: string; ref?: string; note?: string;
};
export type CoinLedger = { v: 1; entries: Entry[] };
export const emptyCoins = (): CoinLedger => ({ v: 1, entries: [] });

export const MAX_ENTRY = 5_000;
/** Earning caps. Idle logins and page opens are not sources at all, and spending never confers an academic or competitive advantage. */
export const EARN_CAPS: Partial<Record<CoinSource, { perDay?: number; perWeek?: number; maxAmount: number }>> = {
  daily_learning: { perDay: 1, maxAmount: 20 },
  weekly_mission: { perWeek: 3, maxAmount: 40 },
  achievement: { maxAmount: 200 },
  teacher_milestone: { maxAmount: 500 },
  referral: { maxAmount: 300 },
  season_grant: { perWeek: 1, maxAmount: 100 },
};
export const PERSISTENCE_GATE = 'Coins are not stored on this deployment yet: no reviewed database migration has been applied, so no balance is shown or kept.';

/** ISO week key (Mon–Sun) of a YYYY-MM-DD day. */
export function weekKey(day: string): string {
  const d = new Date(`${day}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function balance(l: CoinLedger): number {
  let b = 0;
  for (const e of l.entries) {
    if (e.kind === 'earn') b += e.amount;
    else if (e.kind === 'spend') b -= e.amount;
    else { const orig = l.entries.find((x) => x.id === e.reverses); if (orig) b += orig.kind === 'spend' ? e.amount : -e.amount; }
  }
  return b;
}
export type Posted = { ok: true; ledger: CoinLedger; duplicate: boolean } | { ok: false; code: string; message: string };
const no = (code: string, message: string): Posted => ({ ok: false, code, message });

/** The only way a ledger changes. The same id twice is a harmless no-op (a replayed request), never a second grant. */
export function post(l: CoinLedger, e: Entry): Posted {
  if (l.entries.some((x) => x.id === e.id)) return { ok: true, ledger: l, duplicate: true };
  if (!e.id || e.id.length > 80) return no('BAD_ID', 'Every entry needs a unique id.');
  if (!Number.isInteger(e.amount) || e.amount <= 0 || e.amount > MAX_ENTRY) return no('BAD_AMOUNT', 'Amounts are whole coins between 1 and 5,000.');
  if (!isDay(e.day)) return no('BAD_DAY', 'Entries carry the local calendar day.');
  if (e.kind === 'earn') {
    const cap = EARN_CAPS[e.source]; if (!cap) return no('NOT_AN_EARN_SOURCE', 'That cannot earn coins.');
    if (e.amount > cap.maxAmount) return no('OVER_CAP', `One ${e.source.replace(/_/g, ' ')} reward is at most ${cap.maxAmount} coins.`);
    const same = l.entries.filter((x) => x.kind === 'earn' && x.source === e.source);
    if (cap.perDay && same.filter((x) => x.day === e.day).length >= cap.perDay) return no('DAILY_LIMIT', 'Already rewarded today.');
    if (cap.perWeek && same.filter((x) => weekKey(x.day) === weekKey(e.day)).length >= cap.perWeek) return no('WEEKLY_LIMIT', 'Weekly limit reached.');
  } else if (e.kind === 'spend') {
    if (e.source !== 'purchase') return no('NOT_A_SPEND_SOURCE', 'Coins are only spent on cosmetic purchases.');
    if (balance(l) < e.amount) return no('INSUFFICIENT_COINS', `That costs ${e.amount} coins; the balance is ${balance(l)}.`);
  } else {
    const orig = l.entries.find((x) => x.id === e.reverses); if (!orig) return no('UNKNOWN_ENTRY', 'There is nothing to reverse.');
    if (orig.kind === 'reversal') return no('NOT_REVERSIBLE', 'A reversal cannot be reversed; post a new entry.');
    if (l.entries.some((x) => x.kind === 'reversal' && x.reverses === orig.id)) return no('ALREADY_REVERSED', 'That entry was already reversed.');
    if (e.amount !== orig.amount) return no('AMOUNT_MISMATCH', 'A reversal restores exactly the original amount.');
    if (orig.kind === 'earn' && balance(l) < e.amount) return no('WOULD_OVERDRAW', 'Reversing this would take the balance below zero; correct it with the person present.');
  }
  return { ok: true, ledger: { ...l, entries: [...l.entries, e] }, duplicate: false };
}
export const history = (l: CoinLedger) => [...l.entries].sort((a, b) => b.at.localeCompare(a.at) || (a.id < b.id ? 1 : -1));
