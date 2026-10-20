/** Deterministic PRNG for the authoritative simulation (xorshift32 on an integer state held inside serializable game state).
 *  Never use Math.random() in sim code. Not cryptographic: tokens use node:crypto (see token.ts). */
export function seedFrom(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0; }
  return h || 1;
}
/** Advance a state; returns [nextState, float in [0,1)]. */
export function nextRandom(state: number): [number, number] {
  let x = state >>> 0;
  x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
  if (x === 0) x = 0x9e3779b9;
  return [x, x / 4294967296];
}
export function randInt(state: number, maxExclusive: number): [number, number] {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) throw new Error('maxExclusive');
  const [n, r] = nextRandom(state); return [n, Math.floor(r * maxExclusive)];
}
/** A tiny stateful stream over one integer state (used where mutation in place is the clearest). */
export class Stream {
  constructor(public state: number) { if (!this.state) this.state = 1; }
  float(): number { const [s, r] = nextRandom(this.state); this.state = s; return r; }
  int(max: number): number { const [s, v] = randInt(this.state, max); this.state = s; return v; }
  range(a: number, b: number): number { return a + (b - a) * this.float(); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]!; }
  chance(p: number): boolean { return this.float() < p; }
}
