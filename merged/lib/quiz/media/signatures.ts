/** Identify a file by its first bytes, never by its name or declared type. Used on the server to verify uploads, and in the browser for early feedback. */
import type { MediaKind } from './contract';

export type Sniffed = { mime: string; kind: MediaKind; width?: number; height?: number };

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));
const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32be = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1]!;
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = u16be(b, i + 2);
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    i += 2 + len;
  }
  return null;
}

/** Returns what the bytes really are, or null for anything not on the allow-list (including SVG, HTML, scripts, executables). */
export function sniff(bytes: Uint8Array): Sniffed | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', kind: 'image', ...(jpegSize(b) ?? {}) };
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return ascii(b, 12, 4) === 'IHDR' ? { mime: 'image/png', kind: 'image', width: u32be(b, 16), height: u32be(b, 20) } : { mime: 'image/png', kind: 'image' };
  }
  const g = ascii(b, 0, 6);
  if (g === 'GIF87a' || g === 'GIF89a') return { mime: 'image/gif', kind: 'gif', width: u16le(b, 6), height: u16le(b, 8) };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const c = ascii(b, 12, 4);
    if (c === 'VP8X' && b.length >= 30) return { mime: 'image/webp', kind: 'image', width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    if (c === 'VP8 ' && b.length >= 30) return { mime: 'image/webp', kind: 'image', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    if (c === 'VP8L' && b.length >= 25) { const v = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24); return { mime: 'image/webp', kind: 'image', width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    return { mime: 'image/webp', kind: 'image' };
  }
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', kind: 'image' };
    // ISO base media: mp4 family. Exclude HEIF/HEIC stills and QuickTime, which browsers do not all play.
    if (/^(isom|iso2|iso4|iso5|iso6|mp41|mp42|avc1|dash|M4V |msdh|3gp)/.test(brand)) return { mime: 'video/mp4', kind: 'video' };
    return null;
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'video/webm', kind: 'video' };
  return null;
}

/** True when the sniffed type is acceptable for the declared one (a JPEG may arrive as image/jpg, etc.). */
export const declaredMatches = (declared: string, actual: string) => declared === actual || (declared === 'image/jpg' && actual === 'image/jpeg');
