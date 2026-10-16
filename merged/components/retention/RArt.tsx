'use client';
import { useEffect, useState } from 'react';
import { loadArt, peekArt, type Art, type ArtKind } from '@/lib/retention/art/loader';

/** Hook: the art for (kind, id), loading its bundle on first use. */
export function useArt(kind: ArtKind, id: string | null | undefined): Art | undefined {
  const [, force] = useState(0);
  const have = id ? peekArt(kind, id) : undefined;
  useEffect(() => {
    if (!id || have) return;
    let live = true;
    loadArt(kind).then(() => { if (live) force(n => n + 1); }).catch(() => { /* art is optional */ });
    return () => { live = false; };
  }, [kind, id, have]);
  return have;
}

/** One finished engraving, drawn inline in currentColor. The `data-z` layers and the ochre accent are styled in _retention.css. */
export function RArt({ kind, id, size = 64, className, title, accent = true }: {
  kind: ArtKind; id: string | null | undefined; size?: number | string; className?: string; title?: string; accent?: boolean;
}) {
  const art = useArt(kind, id);
  if (!art) return <span className={className} style={{ display: 'inline-block', width: size, height: size }} aria-hidden="true" />;
  return (
    <svg className={`rart${accent ? ' rart-accent' : ''}${className ? ' ' + className : ''}`} width={size} height={size} viewBox="0 0 100 100"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      role="img" aria-label={title ?? art.l} dangerouslySetInnerHTML={{ __html: art.b }} />
  );
}
