import published from '@/data/mode_packets.json';
import { releaseHash } from '@/lib/content/releaseManifest';
import { stableStringify } from './stableJson';
import type { ModeId } from './types';

/* Tickets 093/097 — the browser side of mode packets. Everything here is OPT-IN, read-only and fail-closed:
   - the player can switch it off (opt-out) and play every mode exactly as before;
   - a packet is shown only if it is in the manifest shipped with THIS build, its SHA-256 re-computes, and it was
     certified for THIS content release;
   - a packet only ever supplies flavour text and a disclosure label. It cannot unlock, score, date or replace anything,
     and it is never written into the Humanity Museum. */

export interface PublishedEntry { hash: string; packet: { modeId: string; releaseHash: string; seed: number; flavor: Record<string, string>; disclosure: string | null; contractVersion: string; verification?: { status?: string } } }
export interface PacketManifest { schemaVersion: 1; packets: PublishedEntry[] }

export const packetManifest = published as unknown as PacketManifest;
const OPT_OUT_KEY = 'es.modepackets.optout';
const PIN_KEY = 'es.modepackets.pins';

export const packetsFeatureOn = (): boolean => process.env.NEXT_PUBLIC_MODE_PACKETS === 'true';

function ls(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
export function isOptedOut(): boolean { try { return ls()?.getItem(OPT_OUT_KEY) === '1'; } catch { return false; } }
export function setOptOut(v: boolean): void { try { if (v) ls()?.setItem(OPT_OUT_KEY, '1'); else ls()?.removeItem(OPT_OUT_KEY); } catch { /* storage unavailable: nothing to remember */ } }

export async function sha256Hex(text: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}

/** Verified published entry for a mode, or null. Never throws. */
export async function verifiedPacket(modeId: ModeId, o: { manifest?: PacketManifest; release?: string; enabled?: boolean; optedOut?: boolean; pinned?: string | null } = {}): Promise<PublishedEntry | null> {
  try {
    if (!(o.enabled ?? packetsFeatureOn()) || (o.optedOut ?? isOptedOut())) return null;
    const m = o.manifest ?? packetManifest;
    if (m.schemaVersion !== 1) return null;
    const release = o.release ?? releaseHash;
    const pin = o.pinned === undefined ? pinnedHash(modeId) : o.pinned;
    const list = m.packets.filter(e => e.packet.modeId === modeId && e.packet.releaseHash === release && e.packet.verification?.status === 'certified');
    const pick = (pin ? list.find(e => e.hash === pin) : null) ?? list[0];
    if (!pick) return null;
    return (await sha256Hex(stableStringify(pick.packet))) === pick.hash ? pick : null;
  } catch { return null; }
}

/** Per-mode pin: a run that started with a packet keeps seeing that packet; if it is gone the run simply has no extra flavour. */
export function pinnedHash(modeId: string): string | null {
  try { const raw = ls()?.getItem(PIN_KEY); const o = raw ? JSON.parse(raw) : {}; return typeof o?.[modeId] === 'string' ? o[modeId] : null; } catch { return null; }
}
export function pinPacket(modeId: string, hash: string): void {
  try { const raw = ls()?.getItem(PIN_KEY); const o = raw ? JSON.parse(raw) : {}; o[modeId] = hash; ls()?.setItem(PIN_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}
export function unpinPacket(modeId: string): void {
  try { const raw = ls()?.getItem(PIN_KEY); const o = raw ? JSON.parse(raw) : {}; delete o[modeId]; ls()?.setItem(PIN_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}

/** The one line a mode card may show. Flavour is plain text only (rendered as a React text node, never as HTML). */
export function noteFrom(e: PublishedEntry | null): { text: string; disclosure: string | null } | null {
  if (!e) return null;
  const first = Object.values(e.packet.flavor)[0];
  return typeof first === 'string' && first ? { text: first, disclosure: e.packet.disclosure } : null;
}
