'use client';
import { useId, useRef, useState } from 'react';
import { ACCEPT_ATTR, describeLimits, type MediaKind, type MediaRole } from '@/lib/quiz/media/contract';
import { uploadMedia } from '@/lib/quiz/media/client';
import { ensureCloudSession } from '@/lib/quiz/session-client';
import MediaView, { type MediaLike } from './MediaView';

export type MediaValue = (MediaLike & { posterId?: string }) | undefined;

/** Attach, replace or remove one image / GIF / video. Alt text is required before the file counts as attached. */
export default function MediaAttach({ label, value, onChange, role, compact, allow }: {
  label: string; value: MediaValue; onChange: (m: MediaValue) => void; role: MediaRole; compact?: boolean; allow?: MediaKind[];
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<MediaLike | null>(null); // uploaded, waiting for alt text
  const accept = allow ? ACCEPT_ATTR.split(',').filter((m) => (allow.includes('image') && /^image\/(?!gif)/.test(m)) || (allow.includes('gif') && m === 'image/gif') || (allow.includes('video') && m.startsWith('video/'))).join(',') : ACCEPT_ATTR;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null); setBusy(0);
    try {
      const cloud = await ensureCloudSession();
      if (cloud.status !== 'ready') throw new Error('Pictures and videos need the online service, which isn’t available right now. Your quiz is still saved on this device — try again later.');
      const up = await uploadMedia(file, role, (p) => setBusy(p), allow);
      setPending({ id: up.id, kind: up.kind, alt: '' });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); if (input.current) input.current.value = ''; }
  }

  const cur = pending ?? value;
  const Alt = cur && (
    <label className="qm-alt">Describe it for people who can’t see it (don’t give away the answer)
      <input value={cur.alt} maxLength={300} onChange={(e) => (pending ? setPending({ ...pending, alt: e.target.value }) : onChange({ ...(value as NonNullable<MediaValue>), alt: e.target.value }))} placeholder="e.g. A green leaf under a microscope" />
    </label>
  );

  return (
    <div className={`qm-attach${compact ? ' compact' : ''}`}>
      {!cur && (
        <>
          <input ref={input} id={inputId} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" className="btn small ghost" disabled={busy !== null} onClick={() => input.current?.click()} aria-describedby={`${inputId}-hint`}>{busy !== null ? `Uploading ${busy}%…` : label}</button>
          {!compact && <span id={`${inputId}-hint`} className="note">{describeLimits()}</span>}
        </>
      )}
      {cur && (
        <div className="qm-chosen">
          <MediaView media={{ ...cur, alt: cur.alt || 'Uploaded file' }} height={compact ? 90 : 200} />
          {Alt}
          <div className="row">
            {pending && <button type="button" className="btn small" disabled={!pending.alt.trim()} onClick={() => { onChange({ id: pending.id, kind: pending.kind, alt: pending.alt.trim() }); setPending(null); }}>Use this file</button>}
            <button type="button" className="btn small ghost" onClick={() => { setPending(null); onChange(undefined); }}>Remove</button>
          </div>
          {pending && !pending.alt.trim() && <p className="note" role="status">Add a short description to continue.</p>}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
