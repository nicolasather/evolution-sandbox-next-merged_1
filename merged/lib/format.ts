const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
];

/** '2026-09-11' → '11 September 2026'. Deliberately not toLocaleDateString:
 *  server and browser locales differ, and a date that renders differently on
 *  each side is a hydration mismatch. */
export function formatDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '—';
}
