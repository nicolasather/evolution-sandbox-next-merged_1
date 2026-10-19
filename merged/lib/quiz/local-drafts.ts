/** Browser-local quiz drafts — what makes "Create a Quiz" work with no email and no account.
 *
 *  - Versioned envelope (`v`) so the format can change later without discarding anyone's work.
 *  - One localStorage key holds a map of drafts. Quiz text is small (no images are stored), so localStorage is enough;
 *    if it is blocked (private mode) or full, writes fail loudly (ok:false) and an in-memory copy keeps the tab working.
 *  - Never throws into React: every storage touch is wrapped.
 *  - Drafts are NEVER deleted by this module on its own: only an explicit delete, or removal after a confirmed cloud copy exists.
 *  This is browser storage, not cloud sync, and the UI says so. */
import type { Question } from './types';

export const LOCAL_PREFIX = 'local-';
export const isLocalId = (id: string) => id.startsWith(LOCAL_PREFIX);

export type LocalDraft = {
  v: 1;
  /** `local-xxxx` for drafts that exist only here; the cloud quiz id for an unsaved-changes buffer of a cloud quiz. */
  key: string;
  /** Set when this entry is a buffer of changes to an existing cloud quiz. */
  cloudId?: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
};

const KEY = 'qz:drafts:v1';
const memory = new Map<string, LocalDraft>();
let usingMemoryOnly = false;

function readAll(): Record<string, LocalDraft> {
  try {
    const raw = localStorage.getItem(KEY);
    usingMemoryOnly = false;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { v?: number; drafts?: Record<string, LocalDraft> };
    if (!parsed || parsed.v !== 1 || typeof parsed.drafts !== 'object' || !parsed.drafts) return {};
    return parsed.drafts;
  } catch {
    usingMemoryOnly = true;
    return Object.fromEntries(memory);
  }
}

export type WriteResult = { ok: true } | { ok: false; reason: 'quota' | 'blocked' };

function writeAll(drafts: Record<string, LocalDraft>): WriteResult {
  Object.entries(drafts).forEach(([k, d]) => memory.set(k, d));
  for (const k of [...memory.keys()]) if (!(k in drafts)) memory.delete(k);
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, drafts }));
    usingMemoryOnly = false;
    return { ok: true };
  } catch (e) {
    usingMemoryOnly = true;
    return { ok: false, reason: e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22) ? 'quota' : 'blocked' };
  }
}

export function storageIsMemoryOnly() { return usingMemoryOnly; }

export function newLocalId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Math.random().toString(36).slice(2, 18);
  return `${LOCAL_PREFIX}${rand}`;
}

export function getLocalDraft(key: string): LocalDraft | null { return readAll()[key] ?? null; }

/** Drafts that exist only on this device (not buffers of cloud quizzes), newest first. */
export function listDeviceDrafts(): LocalDraft[] {
  return Object.values(readAll()).filter((d) => !d.cloudId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveLocalDraft(input: Pick<LocalDraft, 'key' | 'title' | 'description' | 'questions'> & { cloudId?: string }): WriteResult {
  const all = readAll();
  const now = new Date().toISOString();
  all[input.key] = { v: 1, key: input.key, cloudId: input.cloudId, title: input.title, description: input.description, questions: input.questions, createdAt: all[input.key]?.createdAt ?? now, updatedAt: now };
  return writeAll(all);
}

export function deleteLocalDraft(key: string): void {
  const all = readAll();
  if (!(key in all)) return;
  delete all[key];
  writeAll(all);
}

/** A plain JSON backup the person can keep, since browser-only drafts are not synced anywhere. */
export function exportDraftJson(d: Pick<LocalDraft, 'title' | 'description' | 'questions'>): string {
  return JSON.stringify({ app: 'quiz-studio', version: 1, exportedAt: new Date().toISOString(), title: d.title, description: d.description, questions: d.questions }, null, 2);
}
