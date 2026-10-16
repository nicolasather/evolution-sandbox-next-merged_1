/* Tiny UI state for the optional layer: whether the Collection drawer is open and on which tab, plus a theme preview
   that is undone when the drawer closes. Not persisted. */
export type HubTab = 'shop' | 'goals' | 'events' | 'cameos' | 'journey' | 'whispers' | 'settings';
interface S { open: boolean; tab: HubTab; previewTheme: string | null; share: string | null }
let s: S = { open: false, tab: 'shop', previewTheme: null, share: null };
const subs = new Set<() => void>();
const set = (p: Partial<S>) => { s = { ...s, ...p }; subs.forEach(f => f()); };
export const hubUi = {
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  get: () => s,
  open(tab?: HubTab) { set({ open: true, tab: tab ?? s.tab }); },
  close() { set({ open: false, previewTheme: null }); },
  tab(tab: HubTab) { set({ tab }); },
  previewTheme(id: string | null) { set({ previewTheme: id }); },
  /** Open the share-card dialog for a discovery id (null closes it). */
  share(id: string | null) { set({ share: id }); },
};
