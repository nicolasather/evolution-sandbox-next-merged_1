import type { Discovery } from '../types';

/** A description of the discovery with its own name — and every word of
 *  it — blanked out. Mirrors lib/engine.ts's `Engine.riddle` exactly (that
 *  method never actually reads `this`), reimplemented as a standalone pure
 *  function so weekly generation never needs a full Engine instance just to
 *  build one clue. */
export function riddleOf(target: Discovery): string {
  let t = target.l1;
  const words = target.n.split(/[\s-]+/).filter(w => w.length > 2);
  for (const w of [target.n, ...words]) {
    t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi'), '…');
  }
  return t;
}
