'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/quiz/client';

export type MediaLike = { id: string; kind: 'image' | 'gif' | 'video'; alt: string; caption?: string; fit?: 'cover' | 'contain'; focusX?: number; focusY?: number };

type View = { url: string; expiresIn: number };
const cache = new Map<string, { v: View; at: number }>();

/** Signed URLs are short-lived; ask again shortly before they would expire. */
function useSignedUrl(id: string) {
  const [state, setState] = useState<{ url: string | null; error: string | null }>({ url: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const hit = cache.get(id);
    const fresh = hit && Date.now() - hit.at < (hit.v.expiresIn - 120) * 1000;
    const apply = (v: View, at: number) => {
      if (!live) return;
      setState({ url: v.url, error: null });
      timer = setTimeout(() => { cache.delete(id); setTick((n) => n + 1); }, Math.max(30, v.expiresIn - 120) * 1000 - (Date.now() - at));
    };
    if (fresh) apply(hit.v, hit.at);
    else api<View>(`/api/quiz/media/${id}/view`).then((v) => { const at = Date.now(); cache.set(id, { v, at }); apply(v, at); })
      .catch((e: Error) => live && setState({ url: null, error: e.message || 'Could not load the file' }));
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [id, tick]);
  return state;
}

/** Renders one stored image / GIF / video. GIFs can be paused (the first frame is drawn to a canvas); videos have native controls. */
export default function MediaView({ media, className = '', height }: { media: MediaLike; className?: string; height?: number }) {
  const { url, error } = useSignedUrl(media.id);
  const [paused, setPaused] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const img = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const style = { objectFit: media.fit ?? 'contain', objectPosition: `${media.focusX ?? 50}% ${media.focusY ?? 50}%`, maxHeight: height } as const;

  const freeze = useCallback(() => {
    const i = img.current, c = canvas.current; if (!i || !c || !i.naturalWidth) return;
    c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d')?.drawImage(i, 0, 0);
  }, []);
  useEffect(() => { if (paused) freeze(); }, [paused, freeze, url]);

  if (error) return <div className={`qm-view qm-error ${className}`} role="img" aria-label={media.alt}><span>Picture unavailable</span></div>;
  if (!url) return <div className={`qm-view qm-loading ${className}`} role="img" aria-label={`Loading: ${media.alt}`} />;

  if (media.kind === 'video') {
    return (
      <figure className={`qm-view ${className}`}>
        <video src={url} controls playsInline preload="metadata" aria-label={media.alt} style={style} />
        {media.caption && <figcaption>{media.caption}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className={`qm-view ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={url} alt={media.alt} style={{ ...style, visibility: media.kind === 'gif' && paused ? 'hidden' : undefined, position: media.kind === 'gif' && paused ? 'absolute' : undefined }} onLoad={() => paused && freeze()} />
      {media.kind === 'gif' && paused && <canvas ref={canvas} role="img" aria-label={`${media.alt} (paused)`} style={style} />}
      {media.kind === 'gif' && (
        <button type="button" className="qm-gif" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? 'Play animation' : 'Pause animation'}</button>
      )}
      {media.caption && <figcaption>{media.caption}</figcaption>}
    </figure>
  );
}
