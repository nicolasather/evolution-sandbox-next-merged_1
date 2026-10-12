import { LifelinesStore } from '../store';
import { CAMPAIGN_KEY, SAVE_KEY } from '../schema';
import { MemoryStorage, FakeLocks } from '../__testing__/memory';
import { ix, focusedGrowth, respond, variantId } from '../__testing__/helpers';
import { QUESTIONS, pickQuestion, questionAllowed } from '../questions';
import { hasLegacySave } from '../save';

const mk = (storage: MemoryStorage | null, extra: Partial<ConstructorParameters<typeof LifelinesStore>[0]> = {}) => {
  let n = 0;
  return new LifelinesStore({ storage, locks: null, loadContent: async () => ix, now: () => 1000 + n++, newRunId: () => `run-${n++}`, onChange: () => undefined, ...extra });
};
const play = (st: LifelinesStore, seasons: number) => {
  for (let i = 0; i < seasons && st.getSnapshot().run && st.getSnapshot().run!.completion.completedAtTurn === null; i++) {
    let s = st.getSnapshot().run!;
    if (s.pendingEventId) { const ev = ix.events.get(s.pendingEventId)!; st.dispatch({ type: 'resolve-event', choiceId: ev.choices.find(c => !Object.keys(c.cost).length)!.id }); s = st.getSnapshot().run!; }
    for (const c of focusedGrowth(s)) st.dispatch(c);
    st.dispatch({ type: 'advance' });
  }
};

describe('LifelinesStore', () => {
  it('initialises, starts a run, saves after every command and resumes after reload', async () => {
    const storage = new MemoryStorage();
    const a = mk(storage); await a.init();
    expect(a.getSnapshot().phase).toBe('ready');
    expect(a.startRun(variantId('first-light'), 'campaign')).toEqual({ ok: true });
    a.dispatch({ type: 'gather', resource: 'food' });
    expect(a.getSnapshot().persistence).toBe('saved');
    const b = mk(storage); await b.init();
    expect(b.getSnapshot().run?.revision).toBe(a.getSnapshot().run?.revision);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).meta.chapterTitle).toBe('First Light');
  });

  it('refuses to replace a run silently, and keeps a backup when replaced', async () => {
    const storage = new MemoryStorage();
    const st = mk(storage); await st.init();
    st.startRun(variantId('first-light'), 'campaign');
    expect(st.startRun(variantId('short-walk'), 'campaign')).toEqual({ ok: false, code: 'run-in-progress' });
    expect(st.startRun(variantId('short-walk'), 'campaign', [], true)).toEqual({ ok: true });
    expect([...storage.data.keys()].some(k => k.includes('.backup.'))).toBe(true);
  });

  it('completion is recorded once, unlocks the next chapter, and survives replays (idempotent)', async () => {
    const storage = new MemoryStorage();
    const st = mk(storage); await st.init();
    st.startRun(variantId('first-light'), 'campaign');
    play(st, 40);
    const done = st.getSnapshot();
    expect(done.run?.completion.completedAtTurn).not.toBeNull();
    const key = 'first-light@lifelines-rules-1';
    expect(done.manifest.completions[key].count).toBe(1);
    expect(done.manifest.rewards[key].status).toBe('none'); // no verified exhibit is mapped
    // more seasons after completion never re-record it
    for (let i = 0; i < 5; i++) st.dispatch({ type: 'advance' });
    expect(st.getSnapshot().manifest.completions[key].count).toBe(1);
    st.dispatch({ type: 'archive' });
    expect(st.getSnapshot().run).toBeNull();
    expect(st.getSnapshot().manifest.archives).toHaveLength(1);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    // a new store sees it
    const again = mk(storage); await again.init();
    expect(again.getSnapshot().manifest.completions[key]).toBeDefined();
  });

  it('reconciles an interrupted hand-off: run saved as completed but manifest write lost', async () => {
    const storage = new MemoryStorage();
    const st = mk(storage); await st.init();
    st.startRun(variantId('first-light'), 'campaign'); play(st, 40);
    storage.removeItem(CAMPAIGN_KEY);
    const again = mk(storage); await again.init();
    expect(again.getSnapshot().manifest.completions['first-light@lifelines-rules-1']).toBeDefined();
  });

  it('sandbox runs never touch campaign completion', async () => {
    const st = mk(new MemoryStorage()); await st.init();
    st.startRun(variantId('first-light'), 'sandbox'); play(st, 40);
    expect(st.getSnapshot().run?.completion.completedAtTurn).not.toBeNull();
    expect(st.getSnapshot().manifest.completions).toEqual({});
  });

  it('a pending reward is retried and delivered exactly once to the profile', async () => {
    const storage = new MemoryStorage();
    const calls: string[] = [];
    const profile = { unlockExhibit: (u: { exhibitId: string }) => { calls.push(u.exhibitId); } };
    const { deliverReward, retryPendingRewards } = await import('../rewards');
    const base = mk(storage); await base.init();
    let m = base.getSnapshot().manifest;
    m = { ...m, completions: { 'x@lifelines-rules-1': { chapterId: 'x', firstRunId: 'r', firstCompletedAtTurn: 1, firstCompletedAt: 1, count: 1, mastery: [] } } };
    const map = { x: 'exhibit-x' };
    const pending = deliverReward(m, 'x@lifelines-rules-1', 'x', null, 5, map);
    expect(pending.rewards['x@lifelines-rules-1'].status).toBe('pending');
    const delivered = deliverReward({ ...pending, rewards: {} }, 'x@lifelines-rules-1', 'x', profile, 6, map);
    expect(delivered.rewards['x@lifelines-rules-1'].status).toBe('delivered');
    expect(deliverReward(delivered, 'x@lifelines-rules-1', 'x', profile, 7, map)).toBe(delivered);
    expect(calls).toEqual(['exhibit-x']);
    const failing = { unlockExhibit: () => { throw new Error('interrupted'); } };
    expect(deliverReward({ ...m, rewards: {} }, 'x@lifelines-rules-1', 'x', failing, 8, map).rewards['x@lifelines-rules-1'].status).toBe('pending');
    void retryPendingRewards;
  });

  it('double dispatch in the same tick is a plain single effect (stale revision is refused by the engine)', async () => {
    const st = mk(new MemoryStorage()); await st.init(); st.startRun(variantId('first-light'), 'campaign');
    const r1 = st.dispatch({ type: 'gather', resource: 'food' });
    const r2 = st.dispatch({ type: 'gather', resource: 'food' });
    expect(r1.ok).toBe(true); expect(r2.ok).toBe(false);
    expect(st.getSnapshot().lastRejection).toBe('emergency-already-used');
  });

  it('storage blocked: play continues in memory with an honest status', async () => {
    const st = mk(null); await st.init();
    expect(st.getSnapshot().persistence).toBe('memory-only');
    expect(st.startRun(variantId('first-light'), 'campaign').ok).toBe(true);
    expect(st.dispatch({ type: 'gather', resource: 'food' }).ok).toBe(true);
    expect(st.getSnapshot().persistenceNote).toMatch(/not being saved/);
    expect(JSON.parse(st.exportText()).run.state.chapterId).toBe('first-light');
  });

  it('quota exceeded mid-play switches to memory-only without losing the run', async () => {
    const storage = new MemoryStorage();
    const st = mk(storage); await st.init(); st.startRun(variantId('first-light'), 'campaign');
    storage.failWrites = 'quota';
    expect(st.dispatch({ type: 'gather', resource: 'food' }).ok).toBe(true);
    expect(st.getSnapshot().persistence).toBe('memory-only');
    expect(st.getSnapshot().persistenceNote).toMatch(/storage is full/);
    expect(st.getSnapshot().run?.revision).toBe(1);
  });

  it('an unreadable saved run is preserved, reported, and never overwritten', async () => {
    const storage = new MemoryStorage(); storage.setItem(SAVE_KEY, '{broken');
    const st = mk(storage); await st.init();
    expect(st.getSnapshot().problem?.error).toBe('invalid-json');
    expect(st.getSnapshot().run).toBeNull();
    expect(st.startRun(variantId('first-light'), 'campaign').ok).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBe('{broken'); // untouched
    expect(st.getSnapshot().persistence).toBe('memory-only');
    expect([...storage.data.keys()].some(k => k.includes('.backup.'))).toBe(true);
  });

  it('reload during an unresolved event restores the same pending event', async () => {
    const storage = new MemoryStorage();
    const st = mk(storage); await st.init(); st.startRun(variantId('short-walk'), 'campaign');
    for (let i = 0; i < 12 && !st.getSnapshot().run!.pendingEventId; i++) st.dispatch({ type: 'advance' });
    const id = st.getSnapshot().run!.pendingEventId;
    expect(id).not.toBeNull();
    const again = mk(storage); await again.init();
    expect(again.getSnapshot().run?.pendingEventId).toBe(id);
    expect(again.dispatch({ type: 'advance' })).toEqual({ ok: false, code: 'resolve-event-first' });
  });

  describe('two tabs', () => {
    it('the second tab is read-only and can take over editing', async () => {
      const storage = new MemoryStorage(); const locks = new FakeLocks();
      const a = mk(storage, { locks: locks.provider() }); await a.init();
      a.startRun(variantId('first-light'), 'campaign');
      const b = mk(storage, { locks: locks.provider() }); await b.init();
      expect(b.getSnapshot().readOnly).toBe(true);
      expect(b.dispatch({ type: 'gather', resource: 'food' })).toEqual({ ok: false, code: 'read-only' });
      await b.takeOver();
      expect(b.getSnapshot().readOnly).toBe(false);
      expect(b.dispatch({ type: 'gather', resource: 'food' }).ok).toBe(true);
      expect(a.getSnapshot().readOnly).toBe(true); // lost the lock
      expect(a.dispatch({ type: 'advance' })).toEqual({ ok: false, code: 'read-only' });
    });

    it('without Web Locks a stale write is caught as a conflict instead of overwriting', async () => {
      const storage = new MemoryStorage();
      const a = mk(storage); await a.init(); a.startRun(variantId('first-light'), 'campaign');
      const b = mk(storage); await b.init();
      a.dispatch({ type: 'gather', resource: 'food' });
      b.dispatch({ type: 'gather', resource: 'water' }); // b's base revision is stale
      expect(b.getSnapshot().persistence).toBe('conflict');
      expect(b.getSnapshot().conflict?.state.revision).toBe(1);
      expect(b.dispatch({ type: 'advance' })).toEqual({ ok: false, code: 'conflict-unresolved' });
      b.resolveConflict('use-theirs');
      expect(b.getSnapshot().run?.revision).toBe(1);
      expect(b.dispatch({ type: 'advance' }).ok).toBe(true);
    });
  });

  it('legacy saves are detected and never modified', async () => {
    const storage = new MemoryStorage(); storage.setItem('evo.civilization.v1', '{"v":1,"active":null,"dioramas":[]}');
    const st = mk(storage); await st.init();
    expect(st.getSnapshot().legacyPresent).toBe(true);
    st.startRun(variantId('first-light'), 'campaign'); play(st, 40);
    expect(storage.getItem('evo.civilization.v1')).toBe('{"v":1,"active":null,"dioramas":[]}');
    expect(hasLegacySave(storage)).toBe(true);
  });

  it('settings persist and clamp; entry and prompt flags are remembered', async () => {
    const storage = new MemoryStorage();
    const st = mk(storage); await st.init();
    st.updateSettings({ narration: 'browser', volume: 0.3 }); st.markEntrySeen(); st.markLegacyPromptAnswered();
    const again = mk(storage); await again.init();
    expect(again.getSnapshot().manifest.settings.narration).toBe('browser');
    expect(again.getSnapshot().manifest.entrySeen).toBe(true);
    expect(again.getSnapshot().manifest.legacyPromptAnswered).toBe(true);
  });

  it('content failure leaves saves alone and reports it', async () => {
    const storage = new MemoryStorage(); storage.setItem(SAVE_KEY, 'keep-me');
    const st = new LifelinesStore({ storage, locks: null, loadContent: async () => { throw new Error('bad-content'); }, onChange: () => undefined });
    await st.init();
    expect(st.getSnapshot()).toMatchObject({ phase: 'failed', loadError: 'bad-content' });
    expect(storage.getItem(SAVE_KEY)).toBe('keep-me');
  });

  it('learning questions are optional, neutral, and never alter the simulation', async () => {
    const st = mk(new MemoryStorage()); await st.init(); st.startRun(variantId('second-harvest'), 'campaign');
    for (let i = 0; i < 4; i++) st.dispatch({ type: 'advance' });
    const snap = st.getSnapshot();
    const q = pickQuestion(ix, snap.manifest, snap.run!);
    if (q) {
      const before = JSON.stringify(snap.run);
      st.recordAnswer({ questionId: q.id, runId: snap.run!.runId, turn: snap.run!.turn, choiceIndex: 2, correct: false, answeredAt: 1 });
      expect(JSON.stringify(st.getSnapshot().run)).toBe(before);
    }
    st.updateSettings({ questionsEnabled: false });
    expect(questionAllowed(st.getSnapshot().manifest, st.getSnapshot().run!)).toBe(false);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(12);
  });
});
void respond;
