'use client';
import { useState } from 'react';
import { ensureCloudSession } from '@/lib/quiz/session-client';
import { parseEmbed } from '@/lib/quiz/media';
import type { Media } from '@/lib/quiz/validation';
import MediaView from '../MediaView';

/** Attach one image, audio clip, video clip or allow-listed embed to a question. Text alternatives are required unless the media is marked decorative. */
export default function MediaField({ media, onChange, idPrefix }: { media?: Media; onChange: (m: Media | undefined) => void; idPrefix: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  async function upload(file: File) {
    setMsg(''); setBusy(true);
    try {
      const s = await ensureCloudSession();
      if (s.status !== 'ready') { setMsg('Uploading needs the online quiz service. You can still paste a YouTube or Vimeo link, or add media later.'); return; }
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/quiz/media', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Upload failed');
      const type = String(j.mime).startsWith('image/') ? 'image' : String(j.mime).startsWith('audio/') ? 'audio' : 'video';
      onChange({ type, ref: j.path, alt: '' } as Media);
      setMsg(`Uploaded. ${(j.remainingBytes / 1048576).toFixed(0)} MB of your space left.`);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }
  function addEmbed() {
    const e = parseEmbed(embedUrl);
    if (!e) { setMsg('Only YouTube and Vimeo links are supported.'); return; }
    onChange({ type: 'embed', ref: e.watchUrl, alt: '' }); setEmbedUrl(''); setMsg('');
  }
  const needsAlt = media && !media.decorative && !(media.alt ?? '').trim();
  return (
    <fieldset className="stack" style={{ border: '1px dashed var(--qz-edge)', padding: 12 }}>
      <legend>Media (optional)</legend>
      {!media && (
        <>
          <label>Upload an image, audio or video file
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/mp4,audio/wav,audio/ogg,video/mp4,video/webm" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input aria-label="YouTube or Vimeo link" placeholder="…or paste a YouTube / Vimeo link" value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} />
            <button type="button" className="btn small ghost" onClick={addEmbed} disabled={!embedUrl.trim()}>Add</button>
          </div>
        </>
      )}
      {media && (
        <>
          <MediaView media={media} compact />
          <label>Describe it for people who cannot see or hear it<input id={`${idPrefix}-alt`} value={media.alt ?? ''} maxLength={500} aria-invalid={needsAlt ? true : undefined} onChange={(e) => onChange({ ...media, alt: e.target.value })} /></label>
          <label className="inline"><input type="checkbox" checked={!!media.decorative} onChange={(e) => onChange({ ...media, decorative: e.target.checked })} /> Decorative only (no description needed)</label>
          <label>Caption (optional)<input value={media.caption ?? ''} maxLength={500} onChange={(e) => onChange({ ...media, caption: e.target.value })} /></label>
          {media.type !== 'image' && <label>Transcript (recommended)<textarea rows={2} maxLength={8000} value={media.transcript ?? ''} onChange={(e) => onChange({ ...media, transcript: e.target.value })} /></label>}
          {media.type === 'video' && <label className="inline"><input type="checkbox" checked={!!media.muted} onChange={(e) => onChange({ ...media, muted: e.target.checked })} /> Start muted</label>}
          {media.type === 'image' && (
            <div className="grid2">
              <label>Focus left–right<input type="range" min={0} max={1} step={0.05} value={media.focal?.x ?? 0.5} onChange={(e) => onChange({ ...media, focal: { x: Number(e.target.value), y: media.focal?.y ?? 0.5 } })} /></label>
              <label>Focus up–down<input type="range" min={0} max={1} step={0.05} value={media.focal?.y ?? 0.5} onChange={(e) => onChange({ ...media, focal: { x: media.focal?.x ?? 0.5, y: Number(e.target.value) } })} /></label>
              <div className="row"><button type="button" className="btn small ghost" onClick={() => onChange({ ...media, rotate: (((media.rotate ?? 0) + 90) % 360) as 0 | 90 | 180 | 270 })}>Rotate 90°</button></div>
            </div>
          )}
          {needsAlt && <p className="bad" role="status">Add a description, or mark it decorative.</p>}
          <div><button type="button" className="btn small danger" onClick={() => onChange(undefined)}>Remove media</button> <span className="note">The original file is kept until you save, so you can undo.</span></div>
        </>
      )}
      {msg && <p className="note" role="status">{msg}</p>}
    </fieldset>
  );
}
