/** Accessibility helpers (items 142-145). Pure. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', ''); const f = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two #rgb / #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
export const AA_TEXT = 4.5;
export const AA_LARGE_OR_UI = 3;
/** Picks black or white text, whichever has the higher contrast on this background. */
export const readableOn = (bg: string) => (contrast(bg, '#ffffff') >= contrast(bg, '#1b1230') ? '#ffffff' : '#1b1230');

/** Messages for aria-live regions, kept in one place so wording is consistent (142). */
export const announce = {
  submitted: (ok: boolean | null) => (ok === null ? 'Answer sent. Waiting for the server to confirm.' : ok ? 'Answer accepted.' : 'Answer not accepted. You can try again.'),
  score: (points: number, delta: number) => `Score ${points}${delta ? `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}` : ''}.`,
  reveal: (correct: boolean) => (correct ? 'Revealed: your answer was correct.' : 'Revealed: your answer was not correct. The correct answer is shown.'),
  unlock: (name: string) => `New item unlocked: ${name}.`,
  error: (msg: string, id?: string) => `Problem: ${msg}${id ? ` Reference ${id}.` : ''}`,
};

/** A short code players can quote to a teacher; contains no personal data (150). */
export function correlationId(rand: () => number = Math.random, now = Date.now()): string {
  return `${now.toString(36).slice(-4).padStart(4, '0')}${Math.floor(rand() * 36 ** 4).toString(36).padStart(4, '0')}`.toUpperCase();
}
export type PlainError = { title: string; message: string; retry: boolean; id: string };
export function plainError(e: unknown, id = correlationId()): PlainError {
  const status = (e as { status?: number })?.status;
  const raw = e instanceof Error ? e.message : '';
  if (status === 401) return { id, retry: false, title: 'Please sign in again', message: 'Your session ended. Your work on this device is safe.' };
  if (status === 403) return { id, retry: false, title: 'You cannot do that here', message: 'This action is not allowed for your role in this room or quiz.' };
  if (status === 404) return { id, retry: false, title: 'We could not find that', message: 'It may have been removed or the code is wrong.' };
  if (status === 429) return { id, retry: true, title: 'Too many tries', message: 'Wait a few seconds and try again.' };
  if (status && status >= 500) return { id, retry: true, title: 'Something went wrong on our side', message: 'Please try again. If it keeps happening, tell your teacher the reference code.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { id, retry: true, title: 'You are offline', message: 'Check your connection. Nothing was lost; we will keep trying.' };
  return { id, retry: true, title: 'That did not work', message: /^[\w .,'’:;!?()-]{4,160}$/.test(raw) ? raw : 'Please try again.' };
}
