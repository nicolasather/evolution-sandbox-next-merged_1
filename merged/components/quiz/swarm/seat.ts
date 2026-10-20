/** A student's seat in an online match is kept in this browser's storage so a reload resumes the same avatar (SW-04).
 *  If the browser refuses storage (private mode, blocked site data, quota) the seat is held in memory for this tab only:
 *  client-side navigation keeps it, a reload loses it, and the player screen says so. Nothing is ever put in a URL. */
export const seatKey = (roomId: string) => `swarm:seat:${roomId}`;
export type Seat = { token: string; workerUrl: string; name: string; code: string; /** true when the seat could not be saved and only lives in this tab */ volatile?: boolean };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

const memory = new Map<string, Seat>();
export const forgetMemorySeats = () => memory.clear();

export function readSeat(roomId: string, store: Store | null = defaultStore()): Seat | null {
  try { const s = store ? (JSON.parse(store.getItem(seatKey(roomId)) ?? 'null') as Seat | null) : null; if (s?.token) return s; } catch { /* fall through to memory */ }
  return memory.get(roomId) ?? null;
}
/** Save the seat and prove it can be read back. 'saved' = survives a reload; 'memory' = this tab only (storage refused). */
export function persistSeat(roomId: string, seat: Seat, store: Store | null = defaultStore()): 'saved' | 'memory' {
  try {
    if (store) {
      store.setItem(seatKey(roomId), JSON.stringify(seat));
      store.setItem('swarm:last', JSON.stringify({ code: seat.code, roomId }));
      if (readSeat(roomId, store)?.token === seat.token && JSON.parse(store.getItem(seatKey(roomId)) ?? 'null')?.token === seat.token) { memory.delete(roomId); return 'saved'; }
    }
  } catch { /* storage refused */ }
  memory.set(roomId, { ...seat, volatile: true });
  return 'memory';
}
export function lastSeatToken(code: string, store: Store | null = defaultStore()): string | undefined {
  try { const last = store ? (JSON.parse(store.getItem('swarm:last') ?? 'null') as { code: string; roomId: string } | null) : null; return last?.code === code ? readSeat(last.roomId, store)?.token : undefined; } catch { return undefined; }
}
