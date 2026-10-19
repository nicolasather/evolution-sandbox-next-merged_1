'use client';
import { useEffect, useRef, useState } from 'react';
import stickers from '@/data/retention/vibe-stickers.json';
import { retention } from '@/lib/retention/store';
import { retentionBus } from '@/lib/retention/bus';
import { RArt } from './RArt';
import { useReducedMotion, useRetention } from './hooks';

const LIST = (stickers as unknown as Array<{ id: string; title: string }>);
const PER = 12;

/** A local reaction wheel: thirty-six etched stickers, twelve to a page. Choosing one lets it float up beside the wheel and
 *  reminds the companion to smile. Nothing is sent anywhere; usage is only counted in this browser. */
export function StickerWheel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useRetention();
  const reduced = useReducedMotion();
  const [page, setPage] = useState(0);
  const [floats, setFloats] = useState<{ key: number; id: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || !r.prefs.stickers) return null;
  const items = LIST.slice(page * PER, page * PER + PER);
  const R = 108;
  const use = (id: string) => {
    retention.useSticker(id);
    retentionBus.emit({ t: 'sticker', id });
    const key = ++seq.current;
    setFloats(f => [...f.slice(-3), { key, id }]);
    window.setTimeout(() => setFloats(f => f.filter(x => x.key !== key)), reduced ? 900 : 2200);
  };
  return (
    <div className="rwheel" ref={ref} role="dialog" aria-label="Reaction wheel" aria-modal="false">
      <div className="rwheel-ring">
        {items.map((s, i) => {
          const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button key={s.id} className="rwheel-s" aria-label={s.title} title={s.title} data-last={r.prefs.sticker === s.id ? '1' : '0'}
              style={{ transform: `translate(${Math.cos(a) * R}px, ${Math.sin(a) * R}px)` }} onClick={() => use(s.id)}>
              <RArt kind="stickers" id={s.id} size={44} />
            </button>
          );
        })}
        <div className="rwheel-mid">
          <button className="chip" onClick={() => setPage(p => (p + 2) % 3)} aria-label="Previous page">‹</button>
          <span className="mono">{page + 1}/3</span>
          <button className="chip" onClick={() => setPage(p => (p + 1) % 3)} aria-label="Next page">›</button>
          <button className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
      {floats.map(f => <span className="rwheel-float" key={f.key} aria-hidden="true"><RArt kind="stickers" id={f.id} size={72} /></span>)}
    </div>
  );
}
