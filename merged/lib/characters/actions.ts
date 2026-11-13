/* The action registry: the only way a creature can do anything REAL. A mode registers a handler for a named, allowlisted
   action; the handler re-validates the live state when it runs, so a stale queued action is rejected. No payload is ever executed. */
import { ACTION_ALLOWLIST, type CharacterActionId, type CharacterMode } from './types';

export interface ActionResult { ok: boolean; reason?: string; data?: Record<string, string | number | boolean | null> }
export type ActionArg = Record<string, string | number | boolean | null>;
export type ActionHandler = (arg?: ActionArg) => ActionResult | Promise<ActionResult>;
export type ModeHandlers = Partial<Record<CharacterActionId, ActionHandler>>;

const table = new Map<CharacterMode, ModeHandlers[]>();

export const actionRegistry = {
  /** Register the live handlers of a mode; returns a cleanup that unregisters exactly these. */
  registerMode(mode: CharacterMode, handlers: ModeHandlers): () => void {
    for (const k of Object.keys(handlers)) if (!ACTION_ALLOWLIST.includes(k as CharacterActionId)) throw new Error(`action "${k}" is not on the allowlist`);
    const list = table.get(mode) ?? [];
    list.push(handlers); table.set(mode, list);
    return () => {
      const l = table.get(mode); if (!l) return;
      const i = l.indexOf(handlers); if (i >= 0) l.splice(i, 1);
      if (!l.length) table.delete(mode);
    };
  },
  has(mode: CharacterMode, id: CharacterActionId): boolean { return !!table.get(mode)?.some(h => h[id]); },
  async run(mode: CharacterMode, id: CharacterActionId, arg?: ActionArg): Promise<ActionResult> {
    if (!ACTION_ALLOWLIST.includes(id)) return { ok: false, reason: 'not-allowlisted' };
    const handlers = table.get(mode);
    const h = handlers && [...handlers].reverse().find(x => x[id])?.[id];
    if (!h) return { ok: false, reason: 'no-handler' };
    try { return await h(arg); } catch { return { ok: false, reason: 'handler-error' }; }
  },
  modesRegistered(): CharacterMode[] { return [...table.keys()]; },
  _clear() { table.clear(); },
};
