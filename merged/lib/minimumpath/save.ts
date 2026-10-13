import { isComplete, validPath } from '@/lib/minimumpath/engine';
import type { Content, Graph, RecordEntry, Run, Save } from '@/lib/minimumpath/types';
export const SAVE_KEY = 'evo.minimumpath.v1';
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function fresh(content: Content): Save {
  return { version: 1, contentVersion: content.version, run: null, records: [], settings: { ...content.defaults } };
}
export function decode(text: string, content: Content, graph: Graph): Save | null {
  if (new TextEncoder().encode(text).length > content.limits.maxSaveBytes) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!object(value) || value.version !== 1 || value.contentVersion !== content.version || !object(value.settings) || !Array.isArray(value.records)) return null;
    const settings = value.settings;
    if (typeof settings.showNames !== 'boolean' || typeof settings.motion !== 'boolean' || typeof settings.textScale !== 'number' ||
        !Number.isFinite(settings.textScale) || settings.textScale < content.limits.minScale || settings.textScale > content.limits.maxScale) return null;
    const parseRun = (entry: unknown): Run | null => {
      if (!object(entry) || typeof entry.missionId !== 'string' || typeof entry.assisted !== 'boolean' || !Array.isArray(entry.path) ||
          !entry.path.every((id: unknown) => typeof id === 'string')) return null;
      const mission = content.missions.find(m => m.id === entry.missionId);
      if (!mission || !validPath(graph, mission, entry.path, content.limits.maxPath)) return null;
      return { missionId: entry.missionId, path: entry.path, assisted: entry.assisted };
    };
    const run = value.run === null ? null : parseRun(value.run);
    if (value.run !== null && !run) return null;
    const records: RecordEntry[] = [];
    const seen = new Set<string>();
    if (value.records.length > content.missions.length * 2) return null;
    for (const entry of value.records) {
      const record = parseRun(entry);
      const mission = content.missions.find(m => m.id === record?.missionId);
      if (!record || !mission || !isComplete(mission, record.path)) return null;
      const key = `${record.missionId}:${record.assisted}`;
      if (seen.has(key)) return null;
      seen.add(key); records.push(record);
    }
    return { version: 1, contentVersion: content.version, run, records,
      settings: { showNames: settings.showNames, motion: settings.motion, textScale: settings.textScale } };
  } catch { return null; }
}
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type Loaded = { kind: 'ok'; save: Save; token: string | null } | { kind: 'invalid' | 'unavailable'; raw: string | null };
export function load(storage: StoragePort, content: Content, graph: Graph): Loaded {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ok', save: fresh(content), token: null };
    const save = decode(raw, content, graph);
    return save ? { kind: 'ok', save, token: raw } : { kind: 'invalid', raw };
  } catch { return { kind: 'unavailable', raw: null }; }
}
export type Write = { kind: 'ok'; token: string } | { kind: 'conflict' | 'unavailable' };
/** The caller holds a Web Lock while comparing and writing; storage errors stay visible. */
export function write(storage: StoragePort, save: Save, token: string | null): Write {
  try {
    if (storage.getItem(SAVE_KEY) !== token) return { kind: 'conflict' };
    const next = JSON.stringify(save);
    storage.setItem(SAVE_KEY, next);
    return { kind: 'ok', token: next };
  } catch { return { kind: 'unavailable' }; }
}
