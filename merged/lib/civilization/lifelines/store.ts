import {
  addArchive, blankManifest, completionKeyFor, evaluateMastery, recordCompletion, summarizeRun,
  type CampaignManifest, type LearningAnswer, type Settings,
} from './campaign';
import { loadLifelinesContent } from './content';
import { createRun, reduce } from './engine';
import { deliverReward, retryPendingRewards, type ProfileLike } from './rewards';
import {
  BACKUP_SUFFIX, browserStorage, clearRun, decodeEnvelope, exportBundle, hasLegacySave, loadCampaign, loadRun,
  stashProblemSave, writeCampaign, writeRun, type RunEnvelope, type SaveErrorCode, type StorageLike,
} from './save';
import {
  CAMPAIGN_KEY, RULES_VERSION, RuleError, SAVE_KEY,
  type Command, type ContentIndex, type DomainEvent, type LifelinesState, type RunMode,
} from './schema';
import { refreshHubSummary } from './hubSummary';
import { devOverrides } from '@/lib/dev/overrides';

/* ============================================================================
   LIFELINES STORE — the one external store the UI reads.
   • Pure engine does all rules; this file owns persistence, tabs and rewards.
   • Single writer: a Web Lock marks the editing tab; others open read-only
     with "Take over editing". A storage event on the save key while we are the
     writer is a conflict the player resolves (keep mine / use theirs / export).
   • Storage failure never stops play: progress continues in memory with an
     honest "Progress is not being saved" status and an export action.
   Dependencies are injectable so every path is testable without a browser.
   ========================================================================== */

export type Persistence = 'saved' | 'unsaved' | 'memory-only' | 'readonly' | 'conflict';

export interface LockProvider {
  /** Resolve true when this tab now owns the writer lock. `steal` takes it from another tab. */
  acquire(steal: boolean, onLost: () => void): Promise<boolean>;
  release(): void;
}

export interface Snapshot {
  phase: 'idle' | 'loading' | 'ready' | 'failed';
  loadError: string | null;
  index: ContentIndex | null;
  run: LifelinesState | null;
  manifest: CampaignManifest;
  persistence: Persistence;
  persistenceNote: string | null;
  readOnly: boolean;
  problem: { error: SaveErrorCode; raw: string } | null;
  conflict: RunEnvelope | null;
  legacyPresent: boolean;
  /** Last rule rejection code (cleared on the next successful command). */
  lastRejection: string | null;
  lastEvents: DomainEvent[];
  announce: string;
}

export interface StoreDeps {
  storage: StorageLike | null;
  now: () => number;
  newRunId: () => string;
  locks: LockProvider | null;
  profile: ProfileLike | null;
  loadContent: () => Promise<ContentIndex>;
  /** Called after any save so the hub card can refresh. */
  onChange?: () => void;
}

export function defaultRunId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return `run-${c.randomUUID()}`;
  } catch { /* fall through */ }
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function webLockProvider(): LockProvider | null {
  try {
    if (typeof navigator === 'undefined' || !('locks' in navigator)) return null;
    let release: (() => void) | null = null;
    return {
      acquire(steal, onLost) {
        return new Promise<boolean>(resolve => {
          try {
            navigator.locks
              .request('evo.civilization.lifelines.writer', steal ? { steal: true } : { ifAvailable: true }, lock => {
                if (!lock) { resolve(false); return undefined; }
                resolve(true);
                return new Promise<void>(r => { release = r; });
              })
              .catch(() => { onLost(); });
          } catch { resolve(true); }
        });
      },
      release() { release?.(); release = null; },
    };
  } catch { return null; }
}

const EMPTY_EVENTS: DomainEvent[] = [];

export class LifelinesStore {
  private snap: Snapshot;
  private listeners = new Set<() => void>();
  private version = 0;
  private busy = false;
  private expectedRevision: number | null = null;
  private deps: StoreDeps;
  private channel: BroadcastChannel | null = null;
  private onStorage: ((e: StorageEvent) => void) | null = null;
  private initPromise: Promise<void> | null = null;
  private attached = false;
  private epoch = 0;

  constructor(deps: Partial<StoreDeps> = {}) {
    this.deps = {
      storage: deps.storage === undefined ? browserStorage() : deps.storage,
      now: deps.now ?? (() => Date.now()),
      newRunId: deps.newRunId ?? defaultRunId,
      locks: deps.locks === undefined ? webLockProvider() : deps.locks,
      profile: deps.profile ?? null,
      loadContent: deps.loadContent ?? loadLifelinesContent,
      onChange: deps.onChange ?? refreshHubSummary,
    };
    this.snap = {
      phase: 'idle', loadError: null, index: null, run: null, manifest: blankManifest('0'),
      persistence: 'saved', persistenceNote: null, readOnly: false, problem: null, conflict: null,
      legacyPresent: false, lastRejection: null, lastEvents: EMPTY_EVENTS, announce: '',
    };
  }

  subscribe = (cb: () => void): (() => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getVersion = (): number => this.version;
  getSnapshot = (): Snapshot => this.snap;

  private set(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.version++;
    this.listeners.forEach(cb => cb());
  }

  /* ------------------------------ lifecycle ------------------------------ */

  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.set({ phase: 'loading', loadError: null });
    let index: ContentIndex;
    try { index = await this.deps.loadContent(); }
    catch (e) {
      this.set({ phase: 'failed', loadError: e instanceof Error ? e.message : 'content-failed' });
      return;
    }
    const { storage } = this.deps;
    const camp = loadCampaign(index, storage);
    let manifest = camp.manifest;
    if (camp.problem) stashProblemSave(storage, camp.problem.raw, this.deps.now());
    const loaded = loadRun(index, storage);

    await this.attach();
    const readOnly = this.snap.readOnly;

    let run: LifelinesState | null = null;
    let problem: Snapshot['problem'] = null;
    if (loaded.kind === 'ok') {
      run = loaded.envelope.state;
      this.expectedRevision = run.revision;
    } else if (loaded.kind === 'problem') {
      problem = { error: loaded.error, raw: loaded.raw };
      if (!readOnly) stashProblemSave(storage, loaded.raw, this.deps.now());
    }

    // Reconcile an interrupted completion hand-off (run saved as completed, manifest write lost).
    if (run && !readOnly) manifest = this.reconcile(run, manifest);
    manifest = retryPendingRewards(manifest, this.deps.profile, this.deps.now());
    if (!readOnly && camp.available) writeCampaign(storage, manifest);

    const persistence: Persistence = !storage ? 'memory-only' : readOnly ? 'readonly' : 'saved';
    this.set({
      phase: 'ready', index, run, manifest, readOnly, problem, persistence,
      persistenceNote: !storage ? 'Progress is not being saved' : readOnly ? 'This settlement is open in another tab' : null,
      legacyPresent: hasLegacySave(storage),
    });
  }

  private reconcile(run: LifelinesState, m: CampaignManifest): CampaignManifest {
    const key = run.completion.completionKey;
    if (run.mode !== 'campaign' || !key || run.completion.completedAtTurn === null) return m;
    let out = m;
    if (!out.completions[key]) {
      out = recordCompletion(out, { key, chapterId: run.chapterId, runId: run.runId, turn: run.completion.completedAtTurn, at: this.deps.now(), mastery: evaluateMastery(run) });
    }
    return deliverReward(out, key, run.chapterId, this.deps.profile, this.deps.now());
  }

  private lostLock(): void {
    if (this.snap.readOnly) return;
    this.set({ readOnly: true, persistence: 'readonly', persistenceNote: 'Another tab took over editing' });
  }

  /** Take the single-writer lock (if available) and start listening for other tabs. Idempotent. */
  async attach(): Promise<void> {
    if (this.attached) return;
    this.attached = true;
    const epoch = ++this.epoch;
    if (this.deps.locks) {
      const got = await this.deps.locks.acquire(false, () => this.lostLock());
      if (epoch !== this.epoch) { if (got) this.deps.locks.release(); return; }
      if (!got) this.set({ readOnly: true, persistence: 'readonly', persistenceNote: 'This settlement is open in another tab' });
    }
    if (typeof window === 'undefined') return;
    this.onStorage = (e: StorageEvent) => {
      if (e.key !== SAVE_KEY && e.key !== CAMPAIGN_KEY) return;
      this.externalChange();
    };
    window.addEventListener('storage', this.onStorage);
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('evo.civilization.lifelines');
        this.channel.onmessage = () => this.externalChange();
      }
    } catch { this.channel = null; }
  }

  /** Re-read saves (re-entering the mode after another tab or mode may have changed them). */
  async reopen(): Promise<void> {
    await this.init();
    await this.attach();
    const idx = this.snap.index;
    if (!idx) return;
    const loaded = loadRun(idx, this.deps.storage);
    const camp = loadCampaign(idx, this.deps.storage);
    if (loaded.kind === 'ok') this.expectedRevision = loaded.envelope.state.revision;
    if (loaded.kind === 'none') this.expectedRevision = null;
    this.set({
      run: loaded.kind === 'ok' ? loaded.envelope.state : loaded.kind === 'none' ? null : this.snap.run,
      manifest: camp.available && !camp.problem ? camp.manifest : this.snap.manifest,
      legacyPresent: hasLegacySave(this.deps.storage),
    });
  }

  /** Release the writer lock and listeners (leaving the mode). The store can be attached again. */
  detach(): void {
    this.attached = false;
    this.epoch++;
    if (typeof window !== 'undefined' && this.onStorage) window.removeEventListener('storage', this.onStorage);
    this.onStorage = null;
    this.channel?.close();
    this.channel = null;
    this.deps.locks?.release();
    if (this.snap.readOnly) this.set({ readOnly: false, persistence: this.deps.storage ? 'saved' : 'memory-only', persistenceNote: null });
  }

  dispose(): void { this.detach(); }

  /** Another tab wrote. Read-only tabs follow along; the writer tab must ask the player. */
  private externalChange(): void {
    const { storage } = this.deps;
    const idx = this.snap.index;
    if (!idx || !storage) return;
    const camp = loadCampaign(idx, storage);
    if (camp.available && !camp.problem) this.set({ manifest: camp.manifest });
    const loaded = loadRun(idx, storage);
    if (loaded.kind !== 'ok') return;
    const theirs = loaded.envelope;
    if (this.snap.readOnly) {
      this.expectedRevision = theirs.state.revision;
      this.set({ run: theirs.state });
      return;
    }
    const mine = this.snap.run;
    if (mine && theirs.state.runId === mine.runId && theirs.state.revision === mine.revision) return;
    if (mine && theirs.state.runId === mine.runId && theirs.state.revision === this.expectedRevision) return;
    this.set({ conflict: theirs, persistence: 'conflict', persistenceNote: 'This settlement changed in another tab' });
  }

  async takeOver(): Promise<void> {
    if (!this.deps.locks) { this.set({ readOnly: false, persistence: 'saved', persistenceNote: null }); return; }
    const got = await this.deps.locks.acquire(true, () => this.lostLock());
    if (!got) return;
    const idx = this.snap.index;
    const loaded = idx ? loadRun(idx, this.deps.storage) : { kind: 'none' as const };
    const run = loaded.kind === 'ok' ? loaded.envelope.state : this.snap.run;
    this.expectedRevision = run ? run.revision : null;
    this.set({ readOnly: false, run, persistence: 'saved', persistenceNote: null, announce: 'You are now editing this settlement.' });
  }

  resolveConflict(choice: 'keep-mine' | 'use-theirs'): void {
    const c = this.snap.conflict;
    if (!c) return;
    if (choice === 'use-theirs') {
      this.expectedRevision = c.state.revision;
      this.set({ run: c.state, conflict: null, persistence: 'saved', persistenceNote: null });
      return;
    }
    // Keep mine: overwrite their revision by adopting it as the expected base, then save ours.
    this.expectedRevision = c.state.revision;
    this.set({ conflict: null });
    if (this.snap.run) this.persistRun(this.snap.run);
  }

  /* ------------------------------ persistence ---------------------------- */

  private persistRun(state: LifelinesState): void {
    const idx = this.snap.index;
    if (!idx || this.snap.readOnly) return;
    const res = writeRun(idx, this.deps.storage, state, this.deps.now(), this.expectedRevision);
    if (res.ok) {
      this.expectedRevision = state.revision;
      this.set({ persistence: 'saved', persistenceNote: null });
      try { this.channel?.postMessage({ runId: state.runId, revision: state.revision }); } catch { /* ignore */ }
      this.deps.onChange?.();
      return;
    }
    if (res.error === 'revision-conflict') {
      const loaded = loadRun(idx, this.deps.storage);
      this.set({
        conflict: loaded.kind === 'ok' ? loaded.envelope : null, persistence: 'conflict',
        persistenceNote: 'This settlement changed in another tab',
      });
      return;
    }
    if (res.error === 'preserve-existing-problem-save') {
      this.set({ persistence: 'memory-only', persistenceNote: 'Progress is not being saved — an unreadable earlier save was kept safe' });
      return;
    }
    this.set({
      persistence: 'memory-only',
      persistenceNote: res.error === 'quota' ? 'Progress is not being saved — storage is full' : 'Progress is not being saved',
    });
  }

  private persistManifest(m: CampaignManifest): void {
    this.set({ manifest: m });
    if (this.snap.readOnly) return;
    const ok = writeCampaign(this.deps.storage, m);
    if (!ok && this.snap.persistence === 'saved') this.set({ persistence: 'memory-only', persistenceNote: 'Progress is not being saved' });
    this.deps.onChange?.();
  }

  /* ------------------------------- commands ------------------------------ */

  /** Synchronous double-submit guard: a second dispatch in the same tick is refused. */
  dispatch(command: Command): { ok: true; events: DomainEvent[] } | { ok: false; code: string } {
    const { index, run } = this.snap;
    if (!index || !run) return { ok: false, code: 'no-run' };
    if (this.snap.readOnly) return { ok: false, code: 'read-only' };
    if (this.snap.conflict) return { ok: false, code: 'conflict-unresolved' };
    if (this.busy) return { ok: false, code: 'busy' };
    this.busy = true;
    try {
      const res = reduce(index, run, { ...command, expectedRevision: run.revision });
      this.set({ run: res.state, lastRejection: null, lastEvents: res.events, announce: announceFor(res.events) });
      this.persistRun(res.state);
      this.handleEvents(index, res.state, res.events);
      return { ok: true, events: res.events };
    } catch (e) {
      const code = e instanceof RuleError ? e.code : 'internal-error';
      this.set({ lastRejection: code });
      return { ok: false, code };
    } finally {
      this.busy = false;
    }
  }

  private handleEvents(index: ContentIndex, state: LifelinesState, events: DomainEvent[]): void {
    let m = this.snap.manifest;
    let changed = false;
    for (const ev of events) {
      if (ev.type === 'chapter-completed' && ev.mode === 'campaign' && !m.completions[ev.completionKey]) {
        m = recordCompletion(m, { key: ev.completionKey, chapterId: ev.chapterId, runId: state.runId, turn: ev.turn, at: this.deps.now(), mastery: evaluateMastery(state) });
        m = deliverReward(m, ev.completionKey, ev.chapterId, this.deps.profile, this.deps.now());
        changed = true;
      } else if (ev.type === 'chapter-completed' && ev.mode === 'campaign') {
        m = deliverReward(m, ev.completionKey, ev.chapterId, this.deps.profile, this.deps.now());
        changed = true;
      }
      if (ev.type === 'run-archived') {
        m = addArchive(m, summarizeRun(index, state, this.deps.now()));
        changed = true;
      }
    }
    if (changed) this.persistManifest(m);
    if (events.some(e => e.type === 'run-archived')) {
      clearRun(this.deps.storage);
      this.expectedRevision = null;
      this.set({ run: null });
      this.deps.onChange?.();
    }
  }

  /* --------------------------------- runs -------------------------------- */

  hasActiveRun(): boolean {
    const r = this.snap.run;
    return !!r && r.completion.status !== 'archived';
  }

  startRun(variantId: string, mode: RunMode, mastery: string[] = [], replace = false): { ok: true } | { ok: false; code: string } {
    const { index, run } = this.snap;
    if (!index) return { ok: false, code: 'no-content' };
    if (this.snap.readOnly) return { ok: false, code: 'read-only' };
    if (run && !replace) return { ok: false, code: 'run-in-progress' };
    try {
      const fresh = createRun(index, { variantId, runId: this.deps.newRunId(), mode, masteryDeclared: mastery });
      if (run) stashProblemSave(this.deps.storage, JSON.stringify({ replacedRun: run }), this.deps.now());
      this.expectedRevision = run ? this.expectedRevision : null;
      if (run) { clearRun(this.deps.storage); this.expectedRevision = null; }
      this.set({ run: fresh, conflict: null, lastRejection: null, lastEvents: EMPTY_EVENTS, announce: 'A new settlement begins.' });
      this.persistRun(fresh);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e instanceof RuleError ? e.code : 'internal-error' };
    }
  }

  /** Leave the current run in place but return to the chapter list (the run stays saved). */
  closeRunView(): void { /* UI state only; the run stays saved. */ }

  /** Discard an unreadable save after the player exported it (it also stays in the backup key). */
  discardProblem(): void {
    this.set({ problem: null });
  }

  importRun(raw: string): { ok: true } | { ok: false; code: SaveErrorCode } {
    const idx = this.snap.index;
    if (!idx) return { ok: false, code: 'invalid-state' };
    if (this.snap.readOnly) return { ok: false, code: 'invalid-state' };
    const d = decodeEnvelope(idx, raw);
    if (!d.ok) return { ok: false, code: d.error };
    if (this.snap.run) stashProblemSave(this.deps.storage, JSON.stringify({ replacedRun: this.snap.run }), this.deps.now());
    clearRun(this.deps.storage);
    this.expectedRevision = null;
    this.set({ run: d.envelope.state, problem: null });
    this.persistRun(d.envelope.state);
    return { ok: true };
  }

  /* ------------------------ campaign-level settings ---------------------- */

  updateSettings(patch: Partial<Settings>): void {
    this.persistManifest({ ...this.snap.manifest, settings: { ...this.snap.manifest.settings, ...patch } });
  }
  markEntrySeen(): void {
    if (this.snap.manifest.entrySeen) return;
    this.persistManifest({ ...this.snap.manifest, entrySeen: true });
  }
  markLegacyPromptAnswered(): void {
    if (this.snap.manifest.legacyPromptAnswered) return;
    this.persistManifest({ ...this.snap.manifest, legacyPromptAnswered: true });
  }
  recordAnswer(a: LearningAnswer): void {
    const m = this.snap.manifest;
    this.persistManifest({ ...m, learning: [...m.learning, a].slice(-200) });
  }
  retryRewards(): void {
    this.persistManifest(retryPendingRewards(this.snap.manifest, this.deps.profile, this.deps.now()));
  }

  /* -------------------------------- export ------------------------------- */

  exportText(): string {
    const { index, run, manifest, problem } = this.snap;
    if (!index) return '{}';
    if (!run && problem) return problem.raw;
    return exportBundle(index, run, manifest, this.deps.now());
  }

  completionKey(chapterId: string): string { return completionKeyFor(chapterId, RULES_VERSION); }

  /* ------------------------- Developer Beta only ------------------------- */

  /**
   * Beta scenarios: record campaign completions for these chapters. Each record is marked
   * `firstRunId: 'dev-scenario'`, so it can always be told apart from a completion the tester
   * earned by playing. Does nothing outside an active, server-authorised beta (and in a
   * read-only tab). Returns how many completions were new.
   */
  devSeedCompletions(chapterIds: readonly string[]): number {
    const { index } = this.snap;
    if (!devOverrides.isActive() || !index || this.snap.readOnly) return 0;
    let m = this.snap.manifest;
    let n = 0;
    for (const id of chapterIds) {
      if (!index.chapters.has(id)) continue;
      const key = completionKeyFor(id, RULES_VERSION);
      if (m.completions[key]) continue;
      m = recordCompletion(m, { key, chapterId: id, runId: 'dev-scenario', turn: 0, at: this.deps.now(), mastery: [] });
      n++;
    }
    if (n > 0) this.persistManifest(m);
    return n;
  }

  /**
   * Beta: begin a campaign run of `chapterId` right now (replacing any run in progress; the old one
   * is kept in the backup key like any other replacement). Inert outside an active beta.
   */
  devStartChapter(chapterId: string): { ok: true } | { ok: false; code: string } {
    const { index } = this.snap;
    if (!devOverrides.isActive()) return { ok: false, code: 'dev-inactive' };
    if (!index) return { ok: false, code: 'no-content' };
    const chapter = index.chapters.get(chapterId);
    if (!chapter) return { ok: false, code: 'unknown-chapter' };
    const variants = index.db.variants.filter(v => v.chapterId === chapterId);
    const variant = variants.find(v => v.biomeId === chapter.recommendedBiome) ?? variants[0];
    if (!variant) return { ok: false, code: 'no-variant' };
    return this.startRun(variant.id, 'campaign', [], true);
  }
}

function announceFor(events: DomainEvent[]): string {
  for (const e of events) {
    if (e.type === 'chapter-completed') return 'The chapter goals are met. You may keep tending the settlement.';
    if (e.type === 'event-scheduled') return 'A decision awaits the council.';
    if (e.type === 'programme-completed') return 'A programme was completed.';
    if (e.type === 'season-advanced') return `Season ${e.turn} begins.`;
  }
  return '';
}

export { BACKUP_SUFFIX };

/** The shared instance the UI uses. Created lazily so SSR never touches storage. */
let shared: LifelinesStore | null = null;
export function lifelinesStore(): LifelinesStore {
  if (!shared) shared = new LifelinesStore();
  return shared;
}
export function resetSharedStore(): void { shared?.dispose(); shared = null; }
