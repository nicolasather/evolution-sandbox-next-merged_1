'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { retentionBus } from '@/lib/retention/bus';
import { loadArt } from '@/lib/retention/art/loader';
import { buildCardSvg, cardFacts, livePalette, shareCard, svgToPng } from '@/lib/retention/share';
import { hubUi } from '@/lib/retention/ui';
import { useHubUi, useRetention } from './hooks';

/** The share-card dialog: a live preview of the SVG card built from the player's real data, then Share / Download. */
export function ShareCard({ engine }: { engine: Engine }) {
  const ui = useHubUi();
  const r = useRetention();
  const id = ui.share;
  const node = id ? engine.get(id) : undefined;
  const [msg, setMsg] = useState('');
  const [ready, setReady] = useState(0);
  useEffect(() => { if (id) loadArt('icons').then(() => setReady(n => n + 1)).catch(() => {}); }, [id]);
  useEffect(() => { if (node && engine.has(node.id)) retentionBus.emit({ t: 'signal', name: 'share-preview', id: node.id }); }, [node, engine]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const svg = useMemo(() => (node && engine.has(node.id) ? buildCardSvg(engine, node, livePalette()) : ''), [engine, node, r.equipped.icon, ready]);
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); hubUi.share(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [id]);
  if (!id || !node || !svg) return null;
  const f = cardFacts(engine, node);
  const go = async () => {
    try {
      const png = await svgToPng(svg);
      const res = await shareCard(png, `evolution-sandbox-${node.n}`);
      if (res !== 'cancelled') retentionBus.emit({ t: 'share', id: node.id });
      setMsg(res === 'shared' ? 'Shared' : res === 'downloaded' ? 'Saved as an image' : '');
    } catch { setMsg('Could not make the image in this browser'); }
  };
  return (
    <div className="rhub-wrap" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) hubUi.share(null); }}>
      <div className="rshare" role="dialog" aria-modal="true" aria-label={`Share card for ${f.name}`}>
        <div className="rshare-card" dangerouslySetInnerHTML={{ __html: svg.replace('width="1080" height="1350"', 'width="100%"') }} />
        <div className="rbtns">
          <button className="chip rbuy" onClick={go}>Share or save image</button>
          <button className="chip" onClick={() => hubUi.share(null)}>Close</button>
        </div>
        <p className="mono rdim">{msg || 'Made from your own save: nothing is uploaded.'}</p>
      </div>
    </div>
  );
}
