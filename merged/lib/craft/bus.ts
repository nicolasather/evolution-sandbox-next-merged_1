/* ============================================================================
   BENCH BUS — how the rest of the app talks to the Workbench without owning
   it. The Workbench registers a handle when it mounts; the inventory rail,
   drag-and-drop and the "Use" button ask it to put things on the bench.
   When no Workbench is mounted (other views, tests) every call is a no-op
   that returns false, so callers can fall back.
   ========================================================================== */

export interface SpawnOptions {
  /** Where to drop it, in viewport pixels. Omit for a free spot. */
  clientX?: number;
  clientY?: number;
  /** A tap: a second tap soon after brings the two together on its own. */
  tap?: boolean;
}

export interface BenchHandle {
  spawn(itemId: string, o?: SpawnOptions): boolean;
  /** Is this viewport point over the bench? */
  contains(clientX: number, clientY: number): boolean;
  element(): HTMLElement | null;
  /** The crew's explicit, narrow capabilities (all go through the real Workbench paths). */
  /** Nothing is being dragged, crafted, resolved or touching: it is safe to act on the bench. */
  canAct?(): boolean;
  /** Put two owned items on the bench so they pull together and combine through the normal path. */
  mergePair?(a: string, b: string): boolean;
  /** Send ONE loose, unheld piece back to the backpack (the normal, undoable fly-home). Returns its item id. */
  returnHome?(): string | null;
  /** Send these items back home (used to put a failed autonomous attempt right). */
  returnItems?(ids: string[]): number;
}

let handle: BenchHandle | null = null;

export function registerBench(h: BenchHandle): () => void {
  handle = h;
  return () => { if (handle === h) handle = null; };
}

export const benchSpawn = (id: string, o?: SpawnOptions): boolean => handle?.spawn(id, o) ?? false;
export const benchContains = (x: number, y: number): boolean => handle?.contains(x, y) ?? false;
export const benchElement = (): HTMLElement | null => handle?.element() ?? null;

export const benchCanAct = (): boolean => handle?.canAct?.() ?? false;
export const benchMergePair = (a: string, b: string): boolean => handle?.mergePair?.(a, b) ?? false;
export const benchReturnHome = (): string | null => handle?.returnHome?.() ?? null;
export const benchReturnItems = (ids: string[]): number => handle?.returnItems?.(ids) ?? 0;
