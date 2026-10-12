import { createRun, forecast, ledgerResidual, queueBlockReason, reduce, tryCommand, validateRunState, project } from '../engine';
import { RuleError } from '../schema';
import { ix, respond, step, tryStep, variantId } from '../__testing__/helpers';

const fresh = (chapter = 'first-light') => createRun(ix, { variantId: variantId(chapter), runId: 'test-run' });
const code = (fn: () => unknown): string => { try { fn(); return ''; } catch (e) { return e instanceof RuleError ? e.code : 'other'; } };
const firstLegal = (s: ReturnType<typeof fresh>, projectId: string) => s.layout.districts.find(d => queueBlockReason(ix, s, projectId, d.id) === null)!.id;

describe('engine', () => {
  it('starts valid and never mutates its input', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    expect(validateRunState(ix, s)).toBeNull();
    reduce(ix, s, { type: 'gather', resource: 'food' });
    forecast(ix, s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('queueing spends the exact cost once and one action', () => {
    const s = fresh();
    const p = ix.projects.get('gathering-rounds')!;
    const n = step(s, { type: 'queue-programme', projectId: p.id, districtId: firstLegal(s, p.id) });
    for (const [r, v] of Object.entries(p.cost)) expect(s.stocks[r as 'food'] - n.stocks[r as 'food']).toBe((v as number) * 1000);
    expect(n.actionsLeft).toBe(s.actionsLeft - 1);
    expect(n.queue).toHaveLength(1);
  });

  it('enforces action budget, duplicates, prerequisites and affordability with reasons', () => {
    let s = fresh();
    const d = firstLegal(s, 'gathering-rounds');
    s = step(s, { type: 'queue-programme', projectId: 'gathering-rounds', districtId: d });
    expect(code(() => reduce(ix, s, { type: 'queue-programme', projectId: 'gathering-rounds', districtId: d }))).toBe('already-queued');
    expect(queueBlockReason(ix, s, 'no-such', null)).toBe('unknown-project');
    const later = ix.db.projects.find(p => p.era > s.era)!;
    expect(queueBlockReason(ix, s, later.id, s.layout.districts[0].id)).toBe('era-locked');
    const needsPrereq = ix.db.projects.find(p => p.era <= s.era && p.requires.length > 0);
    if (needsPrereq) expect(queueBlockReason(ix, s, needsPrereq.id, s.layout.districts[0].id)).toBe('missing-prerequisite');
    s = step(s, { type: 'gather', resource: 'food' });
    expect(code(() => reduce(ix, s, { type: 'gather', resource: 'food' }))).toBe('no-actions');
  });

  it('is deterministic: same seed and commands give identical states', () => {
    const run = () => {
      let s = fresh('short-walk');
      s = step(s, { type: 'queue-programme', projectId: ix.chapters.get('short-walk')!.targetProjectId, districtId: firstLegal(s, ix.chapters.get('short-walk')!.targetProjectId) });
      for (let i = 0; i < 8; i++) s = tryStep(respond(s), { type: 'advance' });
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });

  it('forecast equals the committed season ledger and the ledger conserves every unit', () => {
    let s = fresh();
    s = step(s, { type: 'queue-programme', projectId: 'gathering-rounds', districtId: firstLegal(s, 'gathering-rounds') });
    const f = forecast(ix, s);
    f.ledger.forEach(l => expect(ledgerResidual(l)).toBe(0));
    const committed = step(s, { type: 'advance' });
    expect(committed.report!.ledger).toEqual(f.ledger);
    expect(committed.turn).toBe(s.turn + 1);
  });

  it('cancel refunds fully before work and only unspent materials after', () => {
    let s = fresh();
    const p = 'gathering-rounds';
    const before = s.stocks;
    s = step(s, { type: 'queue-programme', projectId: p, districtId: firstLegal(s, p) });
    const refunded = step(s, { type: 'cancel-queue', queueId: s.queue[0].queueId });
    expect(refunded.stocks).toEqual(before);
    expect(refunded.actionsLeft).toBe(fresh().actionsLeft);
    let started = step(s, { type: 'advance' });
    if (started.queue[0] && started.queue[0].workDone > 0) {
      started = respond(started);
      const c = step(started, { type: 'cancel-queue', queueId: started.queue[0].queueId });
      expect(c.stocks.materials).toBeLessThanOrEqual(started.stocks.materials + (started.queue[0].committed.materials ?? 0));
      expect(c.stocks.knowledge).toBe(started.stocks.knowledge);
    }
  });

  it('stale revisions are rejected', () => {
    const s = fresh();
    const a = step(s, { type: 'gather', resource: 'food' });
    expect(code(() => reduce(ix, a, { type: 'note-hint', expectedRevision: s.revision }))).toBe('revision-conflict');
    expect(() => reduce(ix, a, { type: 'note-hint', expectedRevision: a.revision })).not.toThrow();
  });

  it('policies: slots, conflicts and order independence', () => {
    const s = fresh('fair-share');
    const byGroup = new Map<string, string>();
    for (const p of ix.db.policies) if (!byGroup.has(p.exclusiveGroup)) byGroup.set(p.exclusiveGroup, p.id);
    const ids = [...byGroup.values()];
    const pick = (list: string[]) => list.map(id => ({ id, districtId: null }));
    expect(code(() => reduce(ix, s, { type: 'set-policies', policies: pick(ids.slice(0, 4)) }))).toBe('invalid-policy-selection');
    const sameGroup = ix.db.policies.filter(p => p.exclusiveGroup === ix.db.policies[0].exclusiveGroup).slice(0, 2).map(p => p.id);
    expect(code(() => reduce(ix, s, { type: 'set-policies', policies: pick(sameGroup) }))).toBe('policy-conflict');
    const a = step(s, { type: 'set-policies', policies: pick(ids.slice(0, 3)) });
    const b = step(s, { type: 'set-policies', policies: pick([...ids.slice(0, 3)].reverse()) });
    expect(a.policies).toEqual(b.policies);
    expect(forecast(ix, a)).toEqual(forecast(ix, b));
    expect(tryCommand(ix, s, { type: 'set-policies', policies: pick(ids.slice(0, 4)) })).toBeNull();
  });

  it('events block advancement until answered; a free option always exists; each applies once', () => {
    let s = fresh('short-walk');
    s = step(s, { type: 'ack-forecast' });
    for (let i = 0; i < 12 && !s.pendingEventId; i++) s = step(s, { type: 'advance' });
    expect(s.pendingEventId).not.toBeNull();
    expect(code(() => reduce(ix, s, { type: 'advance' }))).toBe('resolve-event-first');
    const ev = ix.events.get(s.pendingEventId!)!;
    const free = ev.choices.find(c => Object.keys(c.cost).length === 0)!;
    const r = step(s, { type: 'resolve-event', choiceId: free.id });
    expect(r.pendingEventId).toBeNull();
    expect(code(() => reduce(ix, r, { type: 'resolve-event', choiceId: free.id }))).toBe('no-event');
  });

  it('shortages are warnings only: long neglect never collapses or goes negative', () => {
    let s = fresh('across-water');
    for (let i = 0; i < 60; i++) s = tryStep(respond(s), { type: 'advance' });
    expect(validateRunState(ix, s)).toBeNull();
    Object.values(s.stocks).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
    expect(s.completion.status).not.toBe('archived');
    expect(s.turn).toBeGreaterThan(40);
    expect(project(ix, s, 3)).toHaveLength(3);
  });

  it('archived runs reject everything', () => {
    const a = step(fresh(), { type: 'archive' });
    expect(code(() => reduce(ix, a, { type: 'gather', resource: 'food' }))).toBe('run-archived');
  });

  it('rejects unknown commands and invalid saved state', () => {
    expect(code(() => reduce(ix, fresh(), { type: 'nope' } as never))).toBe('unknown-action');
    const bad = { ...fresh(), stocks: { ...fresh().stocks, food: -5 } };
    expect(validateRunState(ix, bad)).not.toBeNull();
    expect(code(() => reduce(ix, bad, { type: 'advance' }))).toBe('invalid-state');
  });
});
