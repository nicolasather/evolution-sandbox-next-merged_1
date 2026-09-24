/* ============================================================================
   BENCH MEMORY — what is lying on the scenery, kept for the session (so a
   reload is not a tidy-up) and for undo (so a mis-click is never a loss).
   Positions are fractions of the free area, so they survive a different
   window size. Storage is a per-viewer convenience: every access is guarded
   and the bench works the same without it.
   ========================================================================== */

export interface Placed { id: string; fx: number; fy: number; a: number }

export const BENCH_KEY = 'evo.bench.v1';
const MAX_UNDO = 24;

const same = (a: Placed[], b: Placed[]) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && Math.abs(p.fx - b[i].fx) < 0.004 && Math.abs(p.fy - b[i].fy) < 0.004);

export class UndoStack {
  private stack: Placed[][] = [];
  push(items: Placed[]) {
    const top = this.stack[this.stack.length - 1];
    if (top && same(top, items)) return;
    this.stack.push(items.map(p => ({ ...p })));
    if (this.stack.length > MAX_UNDO) this.stack.shift();
  }
  pop(): Placed[] | null { return this.stack.pop() ?? null; }
  get size() { return this.stack.length; }
  clear() { this.stack = []; }
}

export function saveBench(items: Placed[]) {
  try { window.localStorage.setItem(BENCH_KEY, JSON.stringify({ v: 1, items })); } catch { /* storage blocked */ }
}

export function loadBench(): Placed[] {
  try {
    const raw = window.localStorage.getItem(BENCH_KEY);
    if (!raw) return [];
    const d = JSON.parse(raw) as { v?: number; items?: Placed[] };
    if (d?.v !== 1 || !Array.isArray(d.items)) return [];
    return d.items
      .filter(p => p && typeof p.id === 'string' && Number.isFinite(p.fx) && Number.isFinite(p.fy))
      .map(p => ({ id: p.id, fx: Math.min(1, Math.max(0, p.fx)), fy: Math.min(1, Math.max(0, p.fy)), a: Number.isFinite(p.a) ? p.a : 0 }))
      .slice(0, 16);
  } catch { return []; }
}

export function clearBench() {
  try { window.localStorage.removeItem(BENCH_KEY); } catch { /* ignore */ }
}
