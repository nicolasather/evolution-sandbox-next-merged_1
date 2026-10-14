import { auditRecord, canonical, redact } from '../modelAudit';

const base = { provider: 'http', model: 'm-1', promptVersion: 'alt-1', template: 'T', input: { b: 1, a: [2, 1] }, response: '{"proposals":[]}' };
describe('model provenance (package 042)', () => {
  it('hashes, never stores template/input/response, and is never a source', () => {
    const r = auditRecord({ ...base, at: '2026-10-14T00:00:00Z', usage: { inputTokens: 10, outputTokens: 3 } });
    expect(r.notASource).toBe(true);
    expect(JSON.stringify(r)).not.toContain('proposals');
    expect(r.templateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 3 });
  });
  it('is deterministic and key-order independent', () => {
    expect(auditRecord({ ...base, at: 'x' })).toEqual(auditRecord({ ...base, input: { a: [2, 1], b: 1 }, at: 'x' }));
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });
  it('redacts keys, bearer tokens and e-mail addresses', () => {
    const t = redact('failed with sk-abcdef123456 and Bearer abcdefgh12345 for me@example.com');
    expect(t).not.toMatch(/sk-abc|abcdefgh12345|me@example/);
    expect(auditRecord({ ...base, provider: 'p sk-abcdef123456' }).provider).not.toContain('sk-');
  });
  it('bad usage numbers become 0', () => {
    expect(auditRecord({ ...base, usage: { inputTokens: -5, outputTokens: NaN } }).usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
