'use client';

import { Glyph } from './Glyph';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';

export function Ending({
  engine, node, onClose, onSeePath,
}: { engine: Engine; node: Discovery; onClose: () => void; onSeePath: () => void }) {
  const s = engine.stats();
  const chain = engine.lineage(node.id);

  const lines = [
    `${s.core + s.hidden} discoveries.`,
    `${s.combos + s.failed} experiments, ${s.failed} of which went nowhere.`,
    `${s.eras} eras crossed.`,
    `${chain.length} steps in the chain that ends here.`,
    'Thousands of years. Countless people. Most of them unnamed.',
  ];

  return (
    <div id="ending" className="on" aria-live="polite">
      <div className="end-wrap">
        <p className="mono" style={{ color: 'var(--bone-4)', marginBottom: 26 }}>YOU STARTED WITH A STONE</p>
        <h2 className="end-lead">And you ended up here.</h2>
        <ul className="end-list">
          {lines.map((l, i) => (
            <li key={l} style={{ animationDelay: `${(i * 0.28 + 0.3).toFixed(2)}s` }}>{l}</li>
          ))}
        </ul>
        <div style={{ width: 74, height: 74, margin: '0 auto', color: 'var(--ochre)' }}>
          <Glyph node={node} />
        </div>
        <div className="end-final">{node.n}</div>
        <p className="end-note">{node.l2}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="begin" onClick={onSeePath}><span>See the whole path</span></button>
          <button className="begin" onClick={onClose}><span>Keep exploring</span><span className="arrow">→</span></button>
        </div>
      </div>
    </div>
  );
}
