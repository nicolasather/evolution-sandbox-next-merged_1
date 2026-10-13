import { beforeAll, expect, test } from '@jest/globals';
import { TextEncoder } from 'node:util';
import { content, graph } from '@/lib/minimumpath/content';
import { shortest } from '@/lib/minimumpath/engine';
import { decode, fresh, load, SAVE_KEY, write } from '@/lib/minimumpath/save';
import type { StoragePort } from '@/lib/minimumpath/save';
beforeAll(() => { Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true }); });
function memory(): StoragePort {
  const map = new Map<string, string>();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
}
test('round trip completed valid run and settings', () => {
  const m = content.missions[0];
  const run = { missionId: m.id, path: shortest(graph, m)!, assisted: true };
  const save = { ...fresh(content), run, records: [run] };
  expect(decode(JSON.stringify(save), content, graph)).toEqual(save);
});
test.each(['{', 'null', '[]', '{"version":99}', '{"__proto__":{"polluted":true}}'])('reject invalid input %s', text => {
  expect(decode(text, content, graph)).toBeNull();
});
test('reject teleport, unknown version, oversized save, repeated records and invalid settings', () => {
  const s = fresh(content); const m = content.missions[0];
  const run = { missionId: m.id, path: shortest(graph, m)!, assisted: false };
  for (const bad of [
    { ...s, contentVersion: 'future' }, { ...s, settings: { ...s.settings, textScale: 99 } },
    { ...s, run: { ...run, path: [m.start, 'nonexistent'] } }, { ...s, records: [run, run] },
    { ...s, run: { ...run, path: [...run.path, m.start] } },
  ]) expect(decode(JSON.stringify(bad), content, graph)).toBeNull();
  expect(decode(' '.repeat(content.limits.maxSaveBytes + 1), content, graph)).toBeNull();
});
test('invalid save is not overwritten; unavailable storage is handled', () => {
  const store = memory(); store.setItem(SAVE_KEY, 'future');
  expect(load(store, content, graph)).toEqual({ kind: 'invalid', raw: 'future' });
  expect(store.getItem(SAVE_KEY)).toBe('future');
  const blocked: StoragePort = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  expect(load(blocked, content, graph).kind).toBe('unavailable');
  expect(write(blocked, fresh(content), null).kind).toBe('unavailable');
});
test('compare token detects conflict and never touches another mode key', () => {
  const store = memory(); store.setItem('evo.civilization.v1', 'keep');
  const s = fresh(content); const first = write(store, s, null);
  expect(first.kind).toBe('ok');
  expect(write(store, s, null).kind).toBe('conflict');
  expect(store.getItem('evo.civilization.v1')).toBe('keep');
});
