'use client';

import { memo } from 'react';
import type { Motif } from '@/lib/museum/history/types';
import { MOTIF_DEFS } from './motifs';

/** An exhibit's line-art reconstruction. Every stroke has pathLength=1 so CSS can
 *  draw it in (`--draw` 0→1) — the "assemble" choreography of app/_museum-gallery.css. */
export const MotifArt = memo(function MotifArt({ motif, className, title }: { motif: Motif; className?: string; title?: string }) {
  const def = MOTIF_DEFS[motif] ?? MOTIF_DEFS['pebble-tool'];
  return (
    <svg viewBox="0 0 100 100" className={'motif' + (className ? ' ' + className : '')} role={title ? 'img' : undefined}
      aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {def.f?.map((d, i) => <path key={'f' + i} d={d} className="mf" />)}
      {def.s.map((d, i) => <path key={i} d={d} pathLength={1} className="ms" style={{ ['--i' as string]: i }} />)}
    </svg>
  );
});
