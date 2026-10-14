/** @jest-environment node */
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { listResults, readResult, readReviews, setReview, writePreview, writeResult } from '../store';
import type { GenRecord } from '../types';

const rec = (id: string): GenRecord => ({ id, version: 1, status: 'failed', model: 'm', generatedAt: 'now', attempts: [], source: 'qwen', failure: { kind: 'timeout', message: 't' } });

describe('store', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vlab-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trips results and lists them', () => {
    writeResult(rec('vl_one'), dir);
    expect(readResult('vl_one', dir)?.failure?.kind).toBe('timeout');
    expect(readResult('vl_two', dir)).toBeNull();
    expect(listResults(dir).map(r => r.id)).toEqual(['vl_one']);
  });
  it('refuses ids that could escape the folder', () => {
    for (const bad of ['../x', 'vl_../../etc', 'vl_a/b', '', 'x', 'vl_' + 'a'.repeat(80)]) {
      expect(() => readResult(bad, dir)).toThrow();
      expect(() => writePreview(bad, '<svg/>', dir)).toThrow();
      expect(() => setReview(bad, 'approved', {}, dir)).toThrow();
    }
  });
  it('stores approve/reject and validated scores locally', () => {
    setReview('vl_one', 'approved', { scores: { recognizability: 4, style: 9, bogus: 3 } as never, note: 'ok' }, dir);
    const r = readReviews(dir).vl_one;
    expect(r.decision).toBe('approved');
    expect(r.scores).toEqual({ recognizability: 4 });
    setReview('vl_one', 'rejected', {}, dir);
    expect(readReviews(dir).vl_one.decision).toBe('rejected');
    expect(readReviews(dir).vl_one.scores).toEqual({ recognizability: 4 });
  });
});
