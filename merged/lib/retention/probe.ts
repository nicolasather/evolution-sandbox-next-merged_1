/* A read-only window onto the bench for the optional layer (easter eggs). The Workbench registers one function;
   nothing here can move, create or remove a body. Coordinates are bench-local pixels plus the host's screen origin. */
export interface ProbeBody {
  uid: number; itemId: string; material: string; x: number; y: number; vx: number; vy: number;
  angle: number; av: number; held: boolean; r: number; temp: boolean;
}
export interface BenchProbe { bodies: ProbeBody[]; busy: boolean; w: number; h: number; left: number; top: number }

let fn: (() => BenchProbe | null) | null = null;
export const registerProbe = (f: () => BenchProbe | null): (() => void) => { fn = f; return () => { if (fn === f) fn = null; }; };
export const readProbe = (): BenchProbe | null => { try { return fn?.() ?? null; } catch { return null; } };
