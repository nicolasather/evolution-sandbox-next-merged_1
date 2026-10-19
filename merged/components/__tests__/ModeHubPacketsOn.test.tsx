import { render, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { TextEncoder as TE } from 'node:util';

jest.mock('@/data/mode_packets.json', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto'); const { stableStringify } = require('@/lib/modes/stableJson');
  const packet = { schemaVersion: 1, modeId: 'decipher', contractVersion: 'decipher.v1', releaseHash: 'c'.repeat(64), seed: 1, approvedItemIds: [], flavor: { theme: 'Quiet hills at dawn' }, scenario: {}, disclosure: 'An invented writing system — not a real language.', verification: { status: 'certified' } };
  return { __esModule: true, default: { schemaVersion: 1, packets: [{ hash: createHash('sha256').update(stableStringify(packet)).digest('hex'), packet }] } };
});
jest.mock('@/lib/content/releaseManifest', () => ({ releaseHash: 'c'.repeat(64) }));

/* Test-only: rendering the whole hub (engine + every card) can exceed Jest's 5 s default when the suite runs in parallel on a busy machine. The assertions are unchanged. */
jest.setTimeout(30_000);

describe('ModeHub with a verified, published packet and the flag ON', () => {
  const OLD = process.env.NEXT_PUBLIC_MODE_PACKETS;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_MODE_PACKETS = 'true';
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    Object.defineProperty(globalThis, 'TextEncoder', { value: TE, configurable: true });
  });
  afterAll(() => { if (OLD === undefined) delete process.env.NEXT_PUBLIC_MODE_PACKETS; else process.env.NEXT_PUBLIC_MODE_PACKETS = OLD; });

  it('shows the plain-text note and the disclosure under the Decipher card, and only there', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ModeHub } = require('../ModeHub'); const { createEngine } = require('@/lib/engine'); const { playDb } = require('@/lib/processing');
    const { container } = render(<ModeHub engine={createEngine(playDb)} active onLaunch={() => {}} />);
    await waitFor(() => expect(container.querySelectorAll('[data-testid="packet-note"]').length).toBe(1));
    const t = container.querySelector('[data-testid="packet-note"]')!.textContent!;
    expect(t).toMatch(/Quiet hills at dawn/);
    expect(t).toMatch(/not a real language/);
    expect(container.querySelector('[data-testid="packet-note"] script')).toBeNull();
  });
});
