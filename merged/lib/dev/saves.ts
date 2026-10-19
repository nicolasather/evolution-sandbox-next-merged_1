import { betaStorageActive } from './storageBoot';
import { DEV_OVERRIDES_KEY, devOverrides } from './overrides';
import { MODES } from '@/lib/modes/registry';
import type { ModeId } from '@/lib/modes/types';

/* ============================================================================
   BETA SAVE TOOLS — export, import, reset and back-up of the beta test save.

   "The beta save" is everything under the beta's own storage namespace (see
   storageBoot.ts) EXCEPT the developer overrides themselves (`evo.dev.v1`),
   which are switches, not progress, and the backup slot.

   Every destructive action refuses unless the namespace is active — otherwise
   "the beta save" would silently mean "this origin's whole localStorage".
   Before anything is overwritten or removed, the current beta save is kept in
   one backup slot so the tester can undo it.
   ========================================================================== */

export const BACKUP_KEY = 'evo.dev.backup.v1';
export const SAVE_FORMAT = 'evolution-sandbox-beta-save';
const MAX_BYTES = 5_000_000;

/** Keys that are not progress. */
const NOT_SAVE = new Set([DEV_OVERRIDES_KEY, BACKUP_KEY]);

export interface BetaSaveFile {
  format: typeof SAVE_FORMAT;
  version: 1;
  exportedAt: string;
  keys: Record<string, string>;
}

export type SaveResult = { ok: true; detail: string } | { ok: false; error: string };

const store = (): Storage | null => { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } };

function allKeys(s: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) out.push(k); }
  return out;
}

/** The beta save as a plain object (overrides and backup slot excluded). */
export function snapshotSave(s: Storage | null = store()): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const k of allKeys(s)) {
    if (NOT_SAVE.has(k) || !k.startsWith('evo.')) continue;
    const v = s.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export function exportSave(s: Storage | null = store()): string {
  const file: BetaSaveFile = { format: SAVE_FORMAT, version: 1, exportedAt: new Date().toISOString(), keys: snapshotSave(s) };
  return JSON.stringify(file, null, 2);
}

/** Validate an import file without touching storage. */
export function parseSaveFile(raw: string): { ok: true; file: BetaSaveFile } | { ok: false; error: string } {
  if (raw.length > MAX_BYTES) return { ok: false, error: 'File quá lớn (tối đa 5 MB).' };
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return { ok: false, error: 'Không đọc được JSON.' }; }
  const f = j as Partial<BetaSaveFile> | null;
  if (!f || typeof f !== 'object' || f.format !== SAVE_FORMAT) return { ok: false, error: 'Không phải file save beta của Evolution Sandbox.' };
  if (f.version !== 1) return { ok: false, error: 'Phiên bản file save không được hỗ trợ.' };
  if (!f.keys || typeof f.keys !== 'object' || Array.isArray(f.keys)) return { ok: false, error: 'File save thiếu dữ liệu.' };
  for (const [k, v] of Object.entries(f.keys)) {
    if (typeof v !== 'string') return { ok: false, error: `Giá trị của "${k}" không hợp lệ.` };
    if (!k.startsWith('evo.') || NOT_SAVE.has(k)) return { ok: false, error: `Khóa không được phép: "${k}".` };
  }
  return { ok: true, file: f as BetaSaveFile };
}

function guard(): { s: Storage } | { error: string } {
  if (!devOverrides.isActive()) return { error: 'Bản beta chưa được máy chủ xác nhận.' };
  if (!betaStorageActive()) return { error: 'Vùng lưu trữ riêng của beta không hoạt động — từ chối để không đụng vào dữ liệu khác.' };
  const s = store();
  return s ? { s } : { error: 'Trình duyệt chặn localStorage.' };
}

/** Keep the current beta save in the backup slot. */
export function backupSave(s: Storage): boolean {
  try { s.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), keys: snapshotSave(s) })); return true; } catch { return false; }
}

function removeAllSave(s: Storage): number {
  let n = 0;
  for (const k of allKeys(s)) if (!NOT_SAVE.has(k) && k.startsWith('evo.')) { s.removeItem(k); n++; }
  return n;
}

/** Replace the whole beta save with a file's content (after a backup). The caller reloads the page. */
export function importSave(raw: string): SaveResult {
  const g = guard(); if ('error' in g) return { ok: false, error: g.error };
  const p = parseSaveFile(raw); if (!p.ok) return p;
  if (!backupSave(g.s)) return { ok: false, error: 'Không tạo được bản sao lưu — dừng lại, chưa ghi gì.' };
  removeAllSave(g.s);
  try { for (const [k, v] of Object.entries(p.file.keys)) g.s.setItem(k, v); }
  catch { return { ok: false, error: 'Ghi thất bại (đầy bộ nhớ?). Bản sao lưu vẫn còn — dùng "Khôi phục".' }; }
  return { ok: true, detail: `Đã nhập ${Object.keys(p.file.keys).length} mục.` };
}

/** Wipe the whole beta test save (after a backup). The caller reloads the page. */
export function resetAll(): SaveResult {
  const g = guard(); if ('error' in g) return { ok: false, error: g.error };
  if (!backupSave(g.s)) return { ok: false, error: 'Không tạo được bản sao lưu — dừng lại, chưa xóa gì.' };
  return { ok: true, detail: `Đã xóa ${removeAllSave(g.s)} mục.` };
}

/** Put the backup slot back. */
export function restoreBackup(): SaveResult {
  const g = guard(); if ('error' in g) return { ok: false, error: g.error };
  let b: { keys?: Record<string, string> } | null = null;
  try { b = JSON.parse(g.s.getItem(BACKUP_KEY) ?? 'null'); } catch { b = null; }
  if (!b?.keys) return { ok: false, error: 'Chưa có bản sao lưu.' };
  removeAllSave(g.s);
  for (const [k, v] of Object.entries(b.keys)) if (k.startsWith('evo.') && !NOT_SAVE.has(k)) g.s.setItem(k, v);
  return { ok: true, detail: `Đã khôi phục ${Object.keys(b.keys).length} mục.` };
}

/* ---------------------------- per-mode reset ----------------------------- */

/** Extra keys a mode keeps besides its registry `saveKey`. */
const EXTRA_KEYS: Partial<Record<ModeId, string[]>> = {
  'main-evolution': ['evo.unlocks.v1', 'evo.learn.v1', 'evo.narrator.mode', 'evo.bench.v1'],
  civilization: ['evo.civilization.lifelines.v2', 'evo.civilization.lifelines.campaign.v2'],
};

/** Every storage key that belongs to one mode (prefix matches catch the Lifelines backup keys too). */
export function keysOfMode(mode: ModeId, s: Storage | null = store()): string[] {
  const def = MODES.find(m => m.id === mode);
  if (!def || !s) return [];
  const exact = new Set([def.saveKey, ...(EXTRA_KEYS[mode] ?? [])]);
  const prefixes = mode === 'civilization' ? ['evo.civilization.lifelines'] : [];
  return allKeys(s).filter(k => exact.has(k) || prefixes.some(p => k.startsWith(p)));
}

/** Remove one mode's save (after a backup). The caller reloads the page so every in-memory store re-reads. */
export function resetMode(mode: ModeId): SaveResult {
  const g = guard(); if ('error' in g) return { ok: false, error: g.error };
  const keys = keysOfMode(mode, g.s);
  if (!MODES.some(m => m.id === mode)) return { ok: false, error: 'Mode không tồn tại trong registry.' };
  if (!backupSave(g.s)) return { ok: false, error: 'Không tạo được bản sao lưu — dừng lại, chưa xóa gì.' };
  keys.forEach(k => g.s.removeItem(k));
  return { ok: true, detail: `Đã xóa ${keys.length} mục của "${mode}".` };
}
