import { blankManifest } from '../campaign';
import { createRun } from '../engine';
import {
  BACKUP_SUFFIX, decodeCampaign, decodeEnvelope, encodeCampaign, loadCampaign, loadRun, makeEnvelope, stashProblemSave, writeCampaign, writeRun,
} from '../save';
import { SAVE_KEY } from '../schema';
import { MemoryStorage } from '../__testing__/memory';
import { ix, step, variantId } from '../__testing__/helpers';

const run = () => createRun(ix, { variantId: variantId('first-light'), runId: 'save-run' });

describe('run envelope', () => {
  it('round-trips the exact state', () => {
    const s = step(run(), { type: 'gather', resource: 'food' });
    const d = decodeEnvelope(ix, JSON.stringify(makeEnvelope(ix, s, 100)));
    expect(d.ok && d.envelope.state).toEqual(s);
    expect(d.ok && d.envelope.meta.chapterTitle).toBe('First Light');
  });
  it.each([
    ['not json', '{oops', 'invalid-json'],
    ['wrong format', JSON.stringify({ format: 'other' }), 'wrong-format'],
    ['future version', JSON.stringify({ format: 'civilization-lifelines', schemaVersion: 3 }), 'future-version'],
    ['old version', JSON.stringify({ format: 'civilization-lifelines', schemaVersion: 1 }), 'old-version'],
    ['unknown content version', JSON.stringify({ ...makeEnvelope(ix, run(), 1), contentVersion: '9.9.9' }), 'content-version-mismatch'],
    ['invalid state', JSON.stringify({ ...makeEnvelope(ix, run(), 1), state: { nonsense: true } }), 'invalid-state'],
  ])('rejects %s', (_n, raw, error) => { expect(decodeEnvelope(ix, raw)).toEqual({ ok: false, error }); });
  it('rejects oversized and non-string input', () => {
    expect(decodeEnvelope(ix, 'x'.repeat(2_000_001))).toEqual({ ok: false, error: 'oversized' });
    expect(decodeEnvelope(ix, null)).toEqual({ ok: false, error: 'invalid-json' });
  });
  it('a valid JSON object with a corrupted stock is not a valid state', () => {
    const e = makeEnvelope(ix, run(), 1);
    (e.state.stocks as Record<string, number>).food = 1.5;
    expect(decodeEnvelope(ix, JSON.stringify(e))).toEqual({ ok: false, error: 'invalid-state' });
  });
});

describe('guarded storage writes', () => {
  it('first save, then advancing revisions', () => {
    const st = new MemoryStorage();
    const s0 = run();
    expect(writeRun(ix, st, s0, 1, null)).toEqual({ ok: true, savedAt: 1 });
    const s1 = step(s0, { type: 'gather', resource: 'food' });
    expect(writeRun(ix, st, s1, 2, s0.revision).ok).toBe(true);
  });
  it('a stale expected revision is a conflict and nothing is overwritten', () => {
    const st = new MemoryStorage();
    const s0 = run(); writeRun(ix, st, s0, 1, null);
    const s1 = step(s0, { type: 'gather', resource: 'food' }); writeRun(ix, st, s1, 2, 0);
    const before = st.getItem(SAVE_KEY);
    expect(writeRun(ix, st, step(s0, { type: 'gather', resource: 'water' }), 3, 0)).toEqual({ ok: false, error: 'revision-conflict' });
    expect(st.getItem(SAVE_KEY)).toBe(before);
  });
  it('never overwrites an unreadable save', () => {
    const st = new MemoryStorage(); st.setItem(SAVE_KEY, '{corrupt');
    expect(writeRun(ix, st, run(), 1, null)).toEqual({ ok: false, error: 'preserve-existing-problem-save' });
    expect(st.getItem(SAVE_KEY)).toBe('{corrupt');
    expect(loadRun(ix, st)).toMatchObject({ kind: 'problem', error: 'invalid-json' });
    expect(stashProblemSave(st, '{corrupt', 5)).toBe(true);
    expect(st.getItem(`${SAVE_KEY}${BACKUP_SUFFIX}.5`)).toBe('{corrupt');
  });
  it('reports a missing expected save, quota, blocked and unavailable storage explicitly', () => {
    const st = new MemoryStorage();
    expect(writeRun(ix, st, run(), 1, 4)).toEqual({ ok: false, error: 'missing-expected-save' });
    st.failWrites = 'quota'; expect(writeRun(ix, st, run(), 1, null)).toEqual({ ok: false, error: 'quota' });
    st.failWrites = 'blocked'; expect(writeRun(ix, st, run(), 1, null)).toEqual({ ok: false, error: 'storage-unavailable' });
    expect(writeRun(ix, null, run(), 1, null)).toEqual({ ok: false, error: 'storage-unavailable' });
    expect(loadRun(ix, null)).toEqual({ kind: 'unavailable' });
  });
});

describe('campaign manifest', () => {
  it('round-trips and bounds lists', () => {
    const m = blankManifest(ix.db.contentVersion);
    m.completions['first-light@lifelines-rules-1'] = { chapterId: 'first-light', firstRunId: 'r', firstCompletedAtTurn: 9, firstCompletedAt: 1, count: 1, mastery: [] };
    const d = decodeCampaign(ix, encodeCampaign(m));
    expect(d.ok && d.manifest.completions).toEqual(m.completions);
  });
  it('survives a different content version (completions are keyed by chapter id + rules version)', () => {
    const m = { ...blankManifest('0.9.0') };
    expect(decodeCampaign(ix, JSON.stringify(m)).ok).toBe(true);
  });
  it('rejects bad input and falls back to a blank manifest, keeping the raw text', () => {
    expect(decodeCampaign(ix, '[]')).toEqual({ ok: false, error: 'wrong-format' });
    const st = new MemoryStorage(); st.setItem('evo.civilization.lifelines.campaign.v2', 'zzz');
    const r = loadCampaign(ix, st);
    expect(r.problem).toEqual({ error: 'invalid-json', raw: 'zzz' });
    expect(r.manifest.completions).toEqual({});
    expect(writeCampaign(null, r.manifest)).toBe(false);
  });
  it('clamps out-of-range settings', () => {
    const m = blankManifest('1.0.0'); m.settings.volume = 9; m.settings.narrationSpeed = 0;
    const d = decodeCampaign(ix, JSON.stringify(m));
    expect(d.ok && d.manifest.settings.volume).toBe(1);
    expect(d.ok && d.manifest.settings.narrationSpeed).toBe(0.5);
  });
});
