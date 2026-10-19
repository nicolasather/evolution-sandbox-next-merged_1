/** Undo / redo for the creator (item 016). Snapshot based, bounded, serialisable so it survives moving between wizard screens
 *  and a page refresh within the same browser session. Pure. */
export type History<T> = { past: T[]; present: T; future: T[]; limit: number };
export const createHistory = <T>(initial: T, limit = 100): History<T> => ({ past: [], present: initial, future: [], limit });

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
export function record<T>(h: History<T>, next: T): History<T> {
  if (same(h.present, next)) return h;
  const past = [...h.past, h.present];
  return { ...h, past: past.length > h.limit ? past.slice(past.length - h.limit) : past, present: next, future: [] };
}
export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
export function undo<T>(h: History<T>): History<T> { return canUndo(h) ? { ...h, past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] } : h; }
export function redo<T>(h: History<T>): History<T> { return canRedo(h) ? { ...h, past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h; }

/** Typing in a field creates one history entry per pause, not per keystroke. */
export function recordCoalesced<T>(h: History<T>, next: T, key: string, lastKey: string | null, replace: boolean): { h: History<T>; key: string } {
  if (replace && lastKey === key && h.past.length) return { h: { ...h, present: next, future: [] }, key };
  return { h: record(h, next), key };
}

const MAX_BYTES = 1_500_000;
export function serialize<T>(h: History<T>): string | null {
  // keep the most recent entries that fit the budget
  let past = h.past; let s = JSON.stringify({ v: 1, h: { ...h, past } });
  while (s.length > MAX_BYTES && past.length > 1) { past = past.slice(Math.ceil(past.length / 4)); s = JSON.stringify({ v: 1, h: { ...h, past, future: h.future.slice(0, 20) } }); }
  return s.length > MAX_BYTES ? null : s;
}
export function parseHistory<T>(raw: string | null): History<T> | null {
  try { const p = JSON.parse(raw ?? ''); if (p?.v === 1 && p.h && Array.isArray(p.h.past) && Array.isArray(p.h.future) && 'present' in p.h) return p.h as History<T>; } catch { /* ignore */ }
  return null;
}
