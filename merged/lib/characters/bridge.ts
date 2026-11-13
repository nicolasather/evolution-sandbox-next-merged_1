/* Translates the optional retention layer's facts (already-happened results) into catalogued character events. Pure mapping:
   it never reads a click and never guesses a result. */
import type { RetentionEvent } from '@/lib/retention/bus';
import { retentionBus } from '@/lib/retention/bus';
import { emitHere } from './bus';

export function mapRetention(e: RetentionEvent): { id: string; payload?: Record<string, string | number | boolean | null> } | null {
  switch (e.t) {
    case 'discovery':
      return e.status === 'new'
        ? { id: 'craft-valid-new', payload: { rare: e.rar === 'rare', hidden: e.hidden } }
        : e.newRoute ? { id: 'craft-known-route' } : null;
    case 'attempt-fail': return { id: 'craft-invalid-pair', payload: { kind: e.kind } };
    case 'technique': return { id: e.produced ? 'technique-produced' : 'technique-selected' };
    case 'inspect': return { id: 'item-inspect', payload: { owned: e.owned } };
    case 'study': return { id: 'item-study' };
    case 'view': return { id: e.view === 'time' ? 'timeline-era-select' : e.view === 'arch' ? 'archive-search' : e.view === 'graph' ? 'graph-node-focus' : 'view-switch', payload: { view: e.view } };
    case 'signal':
      if (e.name === 'home') return { id: 'inventory-drop-home' };
      if (e.name === 'hint') return { id: 'hint-request' };
      return null;
    default: return null;
  }
}

/** Subscribe once; returns a cleanup. */
export function attachRetentionBridge(): () => void {
  return retentionBus.on(e => {
    const m = mapRetention(e);
    if (m) emitHere(m.id, m.payload);
  });
}
