/* A tiny queue of quiet notices (a coin earned, an achievement, a daily done). The HUD shows at most two,
   briefly, in the corner; nothing blocks, nothing demands a click. */
export type NoticeKind = 'coin' | 'achievement' | 'daily' | 'egg' | 'npc' | 'event' | 'info';
export interface Notice { key: number; kind: NoticeKind; title: string; sub?: string; coins?: number }

let seq = 0;
let list: Notice[] = [];
const subs = new Set<() => void>();

export const notices = {
  subscribe(cb: () => void) { subs.add(cb); return () => { subs.delete(cb); }; },
  get(): readonly Notice[] { return list; },
  push(n: Omit<Notice, 'key'>) {
    list = [...list.slice(-3), { ...n, key: ++seq }];
    subs.forEach(cb => cb());
    const key = seq;
    if (typeof window !== 'undefined') window.setTimeout(() => notices.dismiss(key), 5200);
  },
  dismiss(key: number) {
    if (!list.some(n => n.key === key)) return;
    list = list.filter(n => n.key !== key);
    subs.forEach(cb => cb());
  },
  clear() { list = []; subs.forEach(cb => cb()); },
};
