/** @jest-environment node */
import { createHash } from 'node:crypto';
import { stableStringify } from '../stableJson';
import { verifiedPacket, noteFrom, packetManifest, type PacketManifest, type PublishedEntry } from '../packets';

const REL = 'a'.repeat(64);
const mkPacket = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1, modeId: 'decipher', contractVersion: 'decipher.v1', releaseHash: REL, seed: 5, approvedItemIds: [],
  flavor: { theme: 'Quiet hills', clueIntro: 'A calm morning.' }, scenario: { baseSeed: 'x' }, disclosure: 'An invented writing system — not a real language.',
  verification: { status: 'certified', certificate: { hash: 'h', minSteps: undefined } }, ...over,
});
const entry = (packet: ReturnType<typeof mkPacket>, hash?: string): PublishedEntry =>
  ({ hash: hash ?? createHash('sha256').update(stableStringify(packet)).digest('hex'), packet: packet as unknown as PublishedEntry['packet'] });
const man = (...e: PublishedEntry[]): PacketManifest => ({ schemaVersion: 1, packets: e });
const on = { enabled: true, optedOut: false, pinned: null as string | null, release: REL };

describe('097 browser packet verification (fail-closed)', () => {
  it('the shipped manifest is empty by default (nothing is served until a human publishes)', () => { expect(packetManifest.packets).toEqual([]); });
  it('shows a correctly hashed packet certified for THIS release', async () => {
    const e = entry(mkPacket());
    expect(await verifiedPacket('decipher', { ...on, manifest: man(e) })).toEqual(e);
  });
  it('hash computed in memory (with an undefined field) equals the hash after a JSON round trip', () => {
    const p = mkPacket();
    expect(stableStringify(p)).toBe(stableStringify(JSON.parse(JSON.stringify(p))));
  });
  it('refuses a tampered packet, a wrong hash, another release, another mode, an uncertified packet and a bad schema', async () => {
    const e = entry(mkPacket());
    const tampered: PublishedEntry = { hash: e.hash, packet: { ...e.packet, flavor: { theme: 'Evil text here' } } };
    expect(await verifiedPacket('decipher', { ...on, manifest: man(tampered) })).toBeNull();
    expect(await verifiedPacket('decipher', { ...on, manifest: man(entry(mkPacket(), 'f'.repeat(64))) })).toBeNull();
    expect(await verifiedPacket('decipher', { ...on, release: 'b'.repeat(64), manifest: man(e) })).toBeNull();
    expect(await verifiedPacket('survival', { ...on, manifest: man(e) })).toBeNull();
    expect(await verifiedPacket('decipher', { ...on, manifest: man(entry(mkPacket({ verification: { status: 'draft' } }))) })).toBeNull();
    expect(await verifiedPacket('decipher', { ...on, manifest: { schemaVersion: 2 } as unknown as PacketManifest })).toBeNull();
    expect(await verifiedPacket('decipher', { ...on, manifest: null as unknown as PacketManifest })).toBeNull();
  });
  it('feature flag off or player opt-out => no packet, every mode plays as before', async () => {
    const m = man(entry(mkPacket()));
    expect(await verifiedPacket('decipher', { ...on, enabled: false, manifest: m })).toBeNull();
    expect(await verifiedPacket('decipher', { ...on, optedOut: true, manifest: m })).toBeNull();
    expect(await verifiedPacket('decipher', { manifest: m, release: REL })).toBeNull();   // default flag is OFF
  });
  it('a pinned packet wins; a pin that no longer exists falls back to the first valid one', async () => {
    const a = entry(mkPacket({ seed: 1 })), b = entry(mkPacket({ seed: 2 }));
    expect((await verifiedPacket('decipher', { ...on, manifest: man(a, b), pinned: b.hash }))!.hash).toBe(b.hash);
    expect((await verifiedPacket('decipher', { ...on, manifest: man(a, b), pinned: 'gone' }))!.hash).toBe(a.hash);
  });
  it('noteFrom exposes plain flavour text and the disclosure only', () => {
    expect(noteFrom(null)).toBeNull();
    expect(noteFrom(entry(mkPacket()))).toEqual({ text: 'Quiet hills', disclosure: 'An invented writing system — not a real language.' });
  });
});
