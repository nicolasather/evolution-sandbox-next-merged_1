/** Team names as the teacher typed them, normalised the same way in the setup form and on the server, so two names that only differ by
 *  case, spacing or Unicode form ("Red", " red ", "ＲＥＤ") are caught as duplicates and a blank name is never silently replaced. */
export function normalizeTeamName(raw: string): string {
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
}
export const teamNameKey = (raw: string) => normalizeTeamName(raw).toLocaleLowerCase('en');

export type TeamNameCheck = { ok: boolean; names: string[]; errors: (string | null)[] };
/** One error per input (null when that name is fine). */
export function checkTeamNames(raw: readonly string[]): TeamNameCheck {
  const names = raw.map(normalizeTeamName);
  const seen = new Map<string, number>();
  const errors = names.map((n, i) => {
    if (!n) return `Team ${i + 1} needs a name.`;
    if (n.length > 40) return `Team ${i + 1}: use at most 40 characters.`;
    const k = teamNameKey(n);
    const first = seen.get(k);
    if (first !== undefined) return `Team ${i + 1} has the same name as team ${first + 1}.`;
    seen.set(k, i);
    return null;
  });
  return { ok: errors.every((e) => e === null), names, errors };
}
