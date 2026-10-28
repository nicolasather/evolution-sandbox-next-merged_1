/** Isomorphic room-code constants (safe for the browser bundle; lib/quizSecurity.ts adds the node:crypto generator). */
/** Projector-safe alphabet: no 0/O/1/I/L. 31 symbols, 31^6 ≈ 8.9e8 codes. */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;
export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}
/** Browser generator using Web Crypto with rejection sampling (no modulo bias). */
export function randomRoomCode(): string {
  const n = ROOM_CODE_ALPHABET.length; const limit = 256 - (256 % n);
  let out = '';
  while (out.length < ROOM_CODE_LENGTH) {
    const buf = new Uint8Array(16); crypto.getRandomValues(buf);
    for (const b of buf) { if (b < limit && out.length < ROOM_CODE_LENGTH) out += ROOM_CODE_ALPHABET[b % n]; }
  }
  return out;
}
