/* The Hub's "Watch now" asks the EventLayer to start a scenario immediately; this is the one-way hand-off. */
type F = { id: string; until: number } | null;
let forced: F = null;
const subs = new Set<() => void>();
export const forceEvent = (id: string, minutes = 20) => { forced = { id, until: Date.now() + minutes * 60_000 }; subs.forEach(f => f()); };
export const clearForced = () => { forced = null; subs.forEach(f => f()); };
export const getForced = (): F => (forced && forced.until > Date.now() ? forced : null);
export const subscribeForced = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
