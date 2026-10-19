'use client';
import { useEffect, useState } from 'react';
import { EMBED_IFRAME_ATTRS, isCanonicalEmbedSrc, parseEmbed, imageStyle } from '@/lib/quiz/media';
import type { Media } from '@/lib/quiz/validation';
import { readToken } from '@/lib/quiz/client';
import { useMediaRoom } from './MediaScope';

/** Renders a question's media safely: uploads through short-lived signed links, embeds only from the allow-list in a sandboxed iframe.
 *  Always has a text alternative; a failed load shows a plain-language fallback instead of breaking the question. */
export default function MediaView({ media, compact = false }: { media: Media; compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isUpload = media.type !== 'embed';
  const roomId = useMediaRoom();
  useEffect(() => {
    if (!isUpload) return;
    let live = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setFailed(false); setUrl(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const token = roomId ? readToken(roomId) : null;
    const q = `path=${encodeURIComponent(media.ref)}${roomId ? `&room=${encodeURIComponent(roomId)}` : ''}`;
    fetch(`/api/quiz/media?${q}`, { cache: 'no-store', headers: token ? { 'x-player-token': token } : {} }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (live) setUrl(j.url); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [media.ref, isUpload, roomId]);

  const box = { maxWidth: '100%', maxHeight: compact ? 160 : 360, borderRadius: 6 } as const;
  const alt = media.decorative ? '' : (media.alt ?? '');
  let body: React.ReactNode = null;
  if (media.type === 'embed') {
    const e = parseEmbed(media.ref);
    if (!e || !isCanonicalEmbedSrc(e.src)) body = <p className="note">This video link is not allowed.</p>;
    else body = <iframe title={media.alt || `${e.provider} video`} src={e.src} width={compact ? 280 : 560} height={compact ? 158 : 315} {...EMBED_IFRAME_ATTRS} style={{ border: 0, maxWidth: '100%' }} />;
  } else if (failed) body = <p className="note" role="status">This {media.type} could not be loaded. {media.alt ? `It shows: ${media.alt}` : ''}</p>;
  else if (!url) body = <p className="note" role="status">Loading {media.type}…</p>;
  else if (media.type === 'image') {
    const st = imageStyle({ focal: media.focal, rotate: media.rotate, crop: media.crop });
    // eslint-disable-next-line @next/next/no-img-element
    body = <img src={url} alt={alt} style={{ ...box, objectFit: 'cover', ...st }} onError={() => setFailed(true)} />;
  } else if (media.type === 'audio') body = <audio controls src={url} preload="none" onError={() => setFailed(true)} aria-label={media.alt || 'Audio clip'} />;
  else body = <video controls src={url} preload="metadata" muted={media.muted} poster={media.poster} style={box} onError={() => setFailed(true)} aria-label={media.alt || 'Video clip'} />;
  return (
    <figure style={{ margin: '0 0 12px' }}>
      {body}
      {media.caption && <figcaption className="note">{media.caption}</figcaption>}
      {media.transcript && (media.type === 'audio' || media.type === 'video' || media.type === 'embed') && <details><summary>Transcript</summary><p className="note" style={{ whiteSpace: 'pre-wrap' }}>{media.transcript}</p></details>}
    </figure>
  );
}
