import { blankManifest, MAX_ARCHIVES, MAX_LEARNING, DEFAULT_SETTINGS, type CampaignManifest } from './campaign';
import { validateRunState } from './engine';
import { CAMPAIGN_KEY, SAVE_KEY, type ContentIndex, type LifelinesState } from './schema';

/* ============================================================================
   LIFELINES SAVE LAYER — pure encode/decode plus guarded storage access.
   Run envelope (`SAVE_KEY`) and campaign manifest (`CAMPAIGN_KEY`) are separate.
   A corrupt or future-version raw string is NEVER overwritten silently: it is
   stashed under a backup key and reported, so the player can export it.
   ========================================================================== */

export const RUN_FORMAT = 'civilization-lifelines';
export const CAMPAIGN_FORMAT = 'civilization-lifelines-campaign';
export const SCHEMA_VERSION = 2;
export const MAX_RAW = 2_000_000;
export const BACKUP_SUFFIX = '.backup';
export const LEGACY_KEY = 'evo.civilization.v1';

export type SaveErrorCode =
  | 'invalid-json' | 'oversized' | 'wrong-format' | 'future-version' | 'old-version'
  | 'content-version-mismatch' | 'invalid-state' | 'invalid-envelope';

export interface RunMeta { chapterTitle: string; turn: number; status: string }
export interface RunEnvelope {
  format: typeof RUN_FORMAT;
  schemaVersion: 2;
  contentVersion: string;
  rulesVersion: string;
  savedAt: number;
  meta: RunMeta;
  state: LifelinesState;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function makeEnvelope(index: ContentIndex, state: LifelinesState, savedAt: number): RunEnvelope {
  const err = validateRunState(index, state);
  if (err || !Number.isSafeInteger(savedAt) || savedAt < 0) throw new Error('invalid-save');
  return {
    format: RUN_FORMAT, schemaVersion: SCHEMA_VERSION, contentVersion: index.db.contentVersion,
    rulesVersion: state.rulesVersion, savedAt,
    meta: { chapterTitle: index.chapters.get(state.chapterId)?.title ?? state.chapterId, turn: state.turn, status: state.completion.status },
    state: clone(state),
  };
}

export type DecodeResult =
  | { ok: true; envelope: RunEnvelope }
  | { ok: false; error: SaveErrorCode };

export function decodeEnvelope(index: ContentIndex, raw: unknown): DecodeResult {
  if (typeof raw !== 'string') return { ok: false, error: 'invalid-json' };
  if (raw.length > MAX_RAW) return { ok: false, error: 'oversized' };
  let e: unknown;
  try { e = JSON.parse(raw); } catch { return { ok: false, error: 'invalid-json' }; }
  if (!isObj(e) || e.format !== RUN_FORMAT) return { ok: false, error: 'wrong-format' };
  if (typeof e.schemaVersion !== 'number') return { ok: false, error: 'invalid-envelope' };
  if (e.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'future-version' };
  if (e.schemaVersion < SCHEMA_VERSION) return { ok: false, error: 'old-version' };
  if (e.contentVersion !== index.db.contentVersion) return { ok: false, error: 'content-version-mismatch' };
  if (!Number.isSafeInteger(e.savedAt) || (e.savedAt as number) < 0) return { ok: false, error: 'invalid-envelope' };
  if (validateRunState(index, e.state) !== null) return { ok: false, error: 'invalid-state' };
  return { ok: true, envelope: e as unknown as RunEnvelope };
}

/* ------------------------------ campaign --------------------------------- */

export type CampaignDecode = { ok: true; manifest: CampaignManifest } | { ok: false; error: SaveErrorCode };

export function encodeCampaign(m: CampaignManifest): string { return JSON.stringify(m); }

export function decodeCampaign(index: ContentIndex, raw: unknown): CampaignDecode {
  if (typeof raw !== 'string') return { ok: false, error: 'invalid-json' };
  if (raw.length > MAX_RAW) return { ok: false, error: 'oversized' };
  let m: unknown;
  try { m = JSON.parse(raw); } catch { return { ok: false, error: 'invalid-json' }; }
  if (!isObj(m) || m.format !== CAMPAIGN_FORMAT) return { ok: false, error: 'wrong-format' };
  if (typeof m.schemaVersion !== 'number') return { ok: false, error: 'invalid-envelope' };
  if (m.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'future-version' };
  if (m.schemaVersion < SCHEMA_VERSION) return { ok: false, error: 'old-version' };
  if (!isObj(m.completions) || !isObj(m.rewards) || !Array.isArray(m.archives) || !Array.isArray(m.learning) || !isObj(m.settings)) {
    return { ok: false, error: 'invalid-envelope' };
  }
  // Content version is allowed to differ for the campaign: completions are keyed by chapter id + rules version.
  const base = blankManifest(index.db.contentVersion);
  const completions: CampaignManifest['completions'] = {};
  for (const [key, v] of Object.entries(m.completions)) {
    if (!isObj(v) || typeof v.chapterId !== 'string' || !Number.isSafeInteger(v.count)) return { ok: false, error: 'invalid-envelope' };
    completions[key] = {
      chapterId: v.chapterId, firstRunId: String(v.firstRunId ?? ''), firstCompletedAtTurn: Number(v.firstCompletedAtTurn ?? 0),
      firstCompletedAt: Number(v.firstCompletedAt ?? 0), count: Math.max(1, v.count as number),
      mastery: Array.isArray(v.mastery) ? (v.mastery.filter(x => typeof x === 'string') as never[]) : [],
    };
  }
  const rewards: CampaignManifest['rewards'] = {};
  for (const [key, v] of Object.entries(m.rewards)) {
    if (!isObj(v)) return { ok: false, error: 'invalid-envelope' };
    const status = v.status === 'delivered' || v.status === 'pending' ? v.status : 'none';
    rewards[key] = { status, exhibitId: typeof v.exhibitId === 'string' ? v.exhibitId : null, updatedAt: Number(v.updatedAt ?? 0) };
  }
  const s = m.settings as Record<string, unknown>;
  const settings = { ...DEFAULT_SETTINGS };
  if (s.narration === 'off' || s.narration === 'subtitles' || s.narration === 'browser') settings.narration = s.narration;
  if (typeof s.subtitles === 'boolean') settings.subtitles = s.subtitles;
  if (typeof s.narrationSpeed === 'number') settings.narrationSpeed = Math.min(1.5, Math.max(0.5, s.narrationSpeed));
  if (typeof s.volume === 'number') settings.volume = Math.min(1, Math.max(0, s.volume));
  if (typeof s.voiceURI === 'string' || s.voiceURI === null) settings.voiceURI = s.voiceURI as string | null;
  if (s.motionSpeed === 'normal' || s.motionSpeed === 'slow' || s.motionSpeed === 'instant') settings.motionSpeed = s.motionSpeed;
  if (typeof s.questionsEnabled === 'boolean') settings.questionsEnabled = s.questionsEnabled;
  if (typeof s.overlay === 'string') settings.overlay = s.overlay as never;
  return {
    ok: true,
    manifest: {
      ...base,
      completions, rewards,
      archives: (m.archives as CampaignManifest['archives']).slice(0, MAX_ARCHIVES),
      learning: (m.learning as CampaignManifest['learning']).slice(-MAX_LEARNING),
      settings,
      entrySeen: m.entrySeen === true,
      legacyPromptAnswered: m.legacyPromptAnswered === true,
    },
  };
}

/* ------------------------------- storage --------------------------------- */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.localStorage;
    const probe = '__lifelines_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch { return null; }
}

export type LoadRunResult =
  | { kind: 'none' }
  | { kind: 'ok'; envelope: RunEnvelope }
  | { kind: 'problem'; error: SaveErrorCode; raw: string }
  | { kind: 'unavailable' };

export function loadRun(index: ContentIndex, storage: StorageLike | null): LoadRunResult {
  if (!storage) return { kind: 'unavailable' };
  let raw: string | null;
  try { raw = storage.getItem(SAVE_KEY); } catch { return { kind: 'unavailable' }; }
  if (raw === null) return { kind: 'none' };
  const d = decodeEnvelope(index, raw);
  return d.ok ? { kind: 'ok', envelope: d.envelope } : { kind: 'problem', error: d.error, raw };
}

/** Keep a problem save in a separate key (never overwritten silently). Returns whether the stash succeeded. */
export function stashProblemSave(storage: StorageLike | null, raw: string, now: number): boolean {
  if (!storage) return false;
  try { storage.setItem(`${SAVE_KEY}${BACKUP_SUFFIX}.${now}`, raw); return true; } catch { return false; }
}

export type WriteResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: 'revision-conflict' | 'preserve-existing-problem-save' | 'storage-unavailable' | 'quota' | 'invalid-save' | 'missing-expected-save' };

/**
 * Revision-guarded write. `expectedRevision` is the revision this tab last read/wrote (null = first save).
 * Best effort in one tab; cross-tab safety comes from the single-writer lock in store.ts.
 */
export function writeRun(
  index: ContentIndex, storage: StorageLike | null, state: LifelinesState, savedAt: number, expectedRevision: number | null,
): WriteResult {
  if (!storage) return { ok: false, error: 'storage-unavailable' };
  let envelope: RunEnvelope;
  try { envelope = makeEnvelope(index, state, savedAt); } catch { return { ok: false, error: 'invalid-save' }; }
  try {
    const existing = storage.getItem(SAVE_KEY);
    if (existing !== null) {
      const d = decodeEnvelope(index, existing);
      if (!d.ok) return { ok: false, error: 'preserve-existing-problem-save' };
      if (d.envelope.state.runId === state.runId && d.envelope.state.revision !== expectedRevision) return { ok: false, error: 'revision-conflict' };
      if (d.envelope.state.runId !== state.runId && expectedRevision !== null) return { ok: false, error: 'revision-conflict' };
    } else if (expectedRevision !== null) {
      return { ok: false, error: 'missing-expected-save' };
    }
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    return { ok: true, savedAt };
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    return { ok: false, error: /quota/i.test(name) ? 'quota' : 'storage-unavailable' };
  }
}

export function clearRun(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try { storage.removeItem(SAVE_KEY); return true; } catch { return false; }
}

export function loadCampaign(index: ContentIndex, storage: StorageLike | null):
  { manifest: CampaignManifest; problem: { error: SaveErrorCode; raw: string } | null; available: boolean } {
  const blank = blankManifest(index.db.contentVersion);
  if (!storage) return { manifest: blank, problem: null, available: false };
  let raw: string | null;
  try { raw = storage.getItem(CAMPAIGN_KEY); } catch { return { manifest: blank, problem: null, available: false }; }
  if (raw === null) return { manifest: blank, problem: null, available: true };
  const d = decodeCampaign(index, raw);
  return d.ok ? { manifest: d.manifest, problem: null, available: true } : { manifest: blank, problem: { error: d.error, raw }, available: true };
}

export function writeCampaign(storage: StorageLike | null, m: CampaignManifest): boolean {
  if (!storage) return false;
  try { storage.setItem(CAMPAIGN_KEY, encodeCampaign(m)); return true; } catch { return false; }
}

/** Does a legacy (pre-Lifelines) Civilization save exist? Never modifies it. */
export function hasLegacySave(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try { return storage.getItem(LEGACY_KEY) !== null; } catch { return false; }
}

/** Export text for the player: the run envelope if valid, else the raw problem save. */
export function exportRunJson(index: ContentIndex, state: LifelinesState, savedAt: number): string {
  return JSON.stringify(makeEnvelope(index, state, savedAt), null, 2);
}
export function exportBundle(index: ContentIndex, state: LifelinesState | null, manifest: CampaignManifest, savedAt: number): string {
  return JSON.stringify({ run: state ? makeEnvelope(index, state, savedAt) : null, campaign: manifest }, null, 2);
}
