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
}

let handle: BenchHandle | null = null;

export function registerBench(h: BenchHandle): () => void {
  handle = h;
  return () => { if (handle === h) handle = null; };
}

export const benchSpawn = (id: string, o?: SpawnOptions): boolean => handle?.spawn(id, o) ?? false;
export const benchContains = (x: number, y: number): boolean => handle?.contains(x, y) ?? false;
export const benchElement = (): HTMLElement | null => handle?.element() ?? null;
