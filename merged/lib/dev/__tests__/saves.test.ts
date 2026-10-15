import { DEV_STORAGE_BOOT, BETA_STORAGE_PREFIX, betaStorageActive } from '../storageBoot';
import { parseSaveFile, exportSave, importSave, resetAll, resetMode, keysOfMode, SAVE_FORMAT, snapshotSave } from '../saves';
import { devOverrides } from '../overrides';

describe('save tools refuse outside an authorised beta', () => {
  beforeEach(() => window.localStorage.clear());
  it('import / reset / per-mode reset do nothing and touch no data', () => {
    window.localStorage.setItem('evo.sandbox.v1', 'PROD');
    const file = JSON.stringify({ format: SAVE_FORMAT, version: 1, exportedAt: '', keys: { 'evo.sandbox.v1': 'X' } });
    for (const r of [importSave(file), resetAll(), resetMode('survival')]) expect(r.ok).toBe(false);
    expect(window.localStorage.getItem('evo.sandbox.v1')).toBe('PROD');
    expect(devOverrides.isActive()).toBe(false);
    expect(betaStorageActive()).toBe(false);
  });
});

describe('import validation', () => {
  const ok = JSON.stringify({ format: SAVE_FORMAT, version: 1, exportedAt: '', keys: { 'evo.sandbox.v1': '{}' } });
  it('accepts a well-formed file', () => expect(parseSaveFile(ok).ok).toBe(true));
  it.each([
    ['garbage', 'nope'],
    ['wrong format', JSON.stringify({ format: 'x', version: 1, keys: {} })],
    ['wrong version', JSON.stringify({ format: SAVE_FORMAT, version: 2, keys: {} })],
    ['foreign key', JSON.stringify({ format: SAVE_FORMAT, version: 1, keys: { 'other.key': '1' } })],
    ['overrides key', JSON.stringify({ format: SAVE_FORMAT, version: 1, keys: { 'evo.dev.v1': '1' } })],
    ['non-string value', JSON.stringify({ format: SAVE_FORMAT, version: 1, keys: { 'evo.a': 1 } })],
    ['array keys', JSON.stringify({ format: SAVE_FORMAT, version: 1, keys: [] })],
  ])('rejects %s', (_n, raw) => expect(parseSaveFile(raw).ok).toBe(false));
  it('export round-trips and leaves overrides/backup out', () => {
    window.localStorage.clear();
    window.localStorage.setItem('evo.survival.v1', 'S');
    window.localStorage.setItem('evo.dev.v1', 'switches');
    window.localStorage.setItem('unrelated', 'u');
    expect(snapshotSave()).toEqual({ 'evo.survival.v1': 'S' });
    const p = parseSaveFile(exportSave());
    expect(p.ok && p.file.keys).toEqual({ 'evo.survival.v1': 'S' });
  });
  it('keysOfMode finds a mode’s keys', () => {
    window.localStorage.clear();
    window.localStorage.setItem('evo.survival.v1', 'S');
    window.localStorage.setItem('evo.sandbox.v1', 'M');
    expect(keysOfMode('survival')).toEqual(['evo.survival.v1']);
  });
});

describe('beta storage namespace isolates data from production keys', () => {
  it('writes land under the evo-beta: prefix and never reach or read production keys', () => {
    const real = window.localStorage;
    real.clear();
    real.setItem('evo.sandbox.v1', 'PRODUCTION-SAVE');
    // run the boot script in a sandboxed copy of window.localStorage's definition
    new Function(DEV_STORAGE_BOOT)();
    try {
      expect(betaStorageActive()).toBe(true);
      expect(window.localStorage.getItem('evo.sandbox.v1')).toBeNull(); // cannot see production's save
      window.localStorage.setItem('evo.sandbox.v1', 'BETA');
      window.localStorage.setItem('evo.x', '1');
      expect(window.localStorage.length).toBe(2);
      expect(real.getItem('evo.sandbox.v1')).toBe('PRODUCTION-SAVE'); // production record untouched
      expect(real.getItem(BETA_STORAGE_PREFIX + 'evo.sandbox.v1')).toBe('BETA');
      window.localStorage.clear(); // clears only beta keys
      expect(real.getItem('evo.sandbox.v1')).toBe('PRODUCTION-SAVE');
    } finally {
      delete (window as unknown as { __EVO_BETA_STORAGE__?: unknown }).__EVO_BETA_STORAGE__;
      Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    }
  });
});
