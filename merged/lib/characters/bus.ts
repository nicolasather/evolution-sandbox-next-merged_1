/* The character bus: FACTUAL events only. A mode emits after the real state transition or result is known; nothing here
   can change a game rule, grant anything or alter a save. Consumers must never throw into the game. */
import { getEvent } from './events';
import type { CharacterEvent, CharacterMode, EventSource, Payload } from './types';

type Handler = (e: CharacterEvent) => void;
const handlers = new Set<Handler>();

export const characterBus = {
  on(h: Handler): () => void { handlers.add(h); return () => { handlers.delete(h); }; },
  emit(e: CharacterEvent): void {
    if (!getEvent(e.id)) return; // only catalogued events exist
    for (const h of [...handlers]) { try { h(e); } catch { /* an optional layer must never break the game */ } }
  },
  /** test helper */
  _size: () => handlers.size,
};

/** Emit a catalogued event from a mode, after the fact. Cheap no-op when nothing listens. */
export function emitCrew(mode: CharacterMode, id: string, payload?: Payload, source: EventSource = 'game'): void {
  if (handlers.size === 0) return;
  characterBus.emit({ id, mode, source, payload, at: Date.now() });
}

/* ── mode context: the facts the scheduler must respect, owned by whoever knows them ── */

export interface CrewContext {
  hidden: boolean; dragging: boolean; typing: boolean; modalOpen: boolean; gateOpen: boolean; busy: boolean; guideActive: boolean;
}
export const IDLE_CONTEXT: CrewContext = { hidden: false, dragging: false, typing: false, modalOpen: false, gateOpen: false, busy: false, guideActive: false };

type CtxFn = () => Partial<CrewContext>;
const providers = new Set<CtxFn>();
/** A component registers what it knows (e.g. Sandbox: busy / modal). Returns a cleanup. */
export function provideCrewContext(fn: CtxFn): () => void { providers.add(fn); return () => { providers.delete(fn); }; }
export function readCrewContext(): CrewContext {
  const out = { ...IDLE_CONTEXT };
  for (const p of providers) {
    try { const c = p(); for (const k of Object.keys(c) as (keyof CrewContext)[]) if (c[k]) out[k] = true; } catch { /* ignore */ }
  }
  return out;
}

/* ── the mode the player is in right now (set once by AppRoot), for emitters that do not know it (Workbench, panels) ── */
let currentMode: CharacterMode = 'main-evolution';
export const setCrewMode = (m: CharacterMode): void => { currentMode = m; };
export const getCrewMode = (): CharacterMode => currentMode;
/** Emit a catalogued event in whatever mode is current. */
export const emitHere = (id: string, payload?: Payload, source: EventSource = 'game'): void => emitCrew(currentMode, id, payload, source);
