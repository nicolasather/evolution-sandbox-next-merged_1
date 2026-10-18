import { blank } from '../editor-model';
import { deleteLocalDraft, exportDraftJson, getLocalDraft, isLocalId, listDeviceDrafts, newLocalId, saveLocalDraft } from '../local-drafts';

beforeEach(() => localStorage.clear());

describe('local guest drafts', () => {
  it('creates ids that are recognisable as device-only', () => {
    const id = newLocalId();
    expect(isLocalId(id)).toBe(true);
    expect(id).not.toBe(newLocalId());
  });

  it('saves and reads back a draft, versioned, with timestamps', () => {
    const key = newLocalId();
    expect(saveLocalDraft({ key, title: 'T', description: 'D', questions: [blank('multiple_choice')] })).toEqual({ ok: true });
    const d = getLocalDraft(key)!;
    expect(d.v).toBe(1);
    expect(d.title).toBe('T');
    expect(d.questions).toHaveLength(1);
    expect(d.createdAt).toBeTruthy();
  });

  it('keeps createdAt when a draft is updated and lists newest first', () => {
    const a = newLocalId(), b = newLocalId();
    saveLocalDraft({ key: a, title: 'A', description: '', questions: [] });
    const created = getLocalDraft(a)!.createdAt;
    saveLocalDraft({ key: b, title: 'B', description: '', questions: [] });
    saveLocalDraft({ key: a, title: 'A2', description: '', questions: [] });
    expect(getLocalDraft(a)!.createdAt).toBe(created);
    expect(listDeviceDrafts()[0]!.title).toBe('A2');
  });

  it('does not list buffers of cloud quizzes as device drafts', () => {
    saveLocalDraft({ key: 'cloud-1', cloudId: 'cloud-1', title: 'Buffer', description: '', questions: [] });
    saveLocalDraft({ key: newLocalId(), title: 'Mine', description: '', questions: [] });
    expect(listDeviceDrafts().map((d) => d.title)).toEqual(['Mine']);
  });

  it('only deletes when asked', () => {
    const key = newLocalId();
    saveLocalDraft({ key, title: 'x', description: '', questions: [] });
    expect(getLocalDraft(key)).not.toBeNull();
    deleteLocalDraft(key);
    expect(getLocalDraft(key)).toBeNull();
  });

  it('ignores an unknown storage version instead of crashing or overwriting', () => {
    localStorage.setItem('qz:drafts:v1', JSON.stringify({ v: 99, drafts: { x: {} } }));
    expect(listDeviceDrafts()).toEqual([]);
  });

  it('reports a failed write instead of throwing', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(saveLocalDraft({ key: newLocalId(), title: 'x', description: '', questions: [] })).toEqual({ ok: false, reason: 'quota' });
    spy.mockRestore();
  });

  it('exports a plain JSON backup', () => {
    const json = JSON.parse(exportDraftJson({ title: 'T', description: '', questions: [] }));
    expect(json.app).toBe('quiz-studio');
    expect(json.title).toBe('T');
  });
});
