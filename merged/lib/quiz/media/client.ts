'use client';
/** Browser side of the upload pipeline. Files go straight to private storage with a one-time signed token; the server then inspects the stored bytes. */
import { api } from '../client';
import { RESUMABLE_ABOVE, checkFileForUpload, type MediaKind, type MediaRole } from './contract';
import { sniff } from './signatures';

export type UploadedMedia = { id: string; kind: MediaKind; mime: string; bytes: number; width?: number; height?: number; poster?: Blob | null };
type Prepared = { id: string; kind: MediaKind; method: 'single' | 'resumable'; url: string; token: string; path: string; bucket: string; resumableEndpoint: string };

export async function uploadMedia(file: File, role: MediaRole, onProgress: (pct: number) => void, allow?: MediaKind[], signal?: AbortSignal): Promise<UploadedMedia> {
  const early = checkFileForUpload(file.type, file.size, allow);
  if (early) throw new Error(early);
  // Check the real bytes too, so a renamed file gets a clear message before any upload starts.
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const found = sniff(head);
  if (!found) throw new Error('That file doesn’t look like a supported image, GIF or video.');
  if (found.mime !== file.type && !(file.type === 'image/jpg' && found.mime === 'image/jpeg')) throw new Error('The file content doesn’t match its type. Re-export it and try again.');

  const prep = await api<Prepared>('/api/quiz/media/prepare', { method: 'POST', json: { filename: file.name, mime: file.type, size: file.size, role }, signal });
  onProgress(1);
  if (prep.method === 'single' && file.size <= RESUMABLE_ABOVE) await putSingle(prep, file, onProgress, signal);
  else await putResumable(prep, file, onProgress);
  const done = await api<Omit<UploadedMedia, 'poster'>>('/api/quiz/media/complete', { method: 'POST', json: { id: prep.id }, signal });
  onProgress(100);
  const poster = done.kind === 'video' ? await capturePoster(file).catch(() => null) : null;
  return { ...done, kind: done.kind as MediaKind, poster };
}

function putSingle(p: Prepared, file: File, onProgress: (n: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', p.url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.max(1, Math.round((e.loaded / e.total) * 95))); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Please try again.`)));
    xhr.onerror = () => reject(new Error('Network problem while uploading. Check your connection and try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    signal?.addEventListener('abort', () => xhr.abort());
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);
    xhr.send(form);
  });
}

async function putResumable(p: Prepared, file: File, onProgress: (n: number) => void): Promise<void> {
  const tus = await import('tus-js-client');
  await new Promise<void>((resolve, reject) => {
    const up = new tus.Upload(file, {
      endpoint: p.resumableEndpoint,
      retryDelays: [0, 1500, 4000, 10000],
      headers: { 'x-signature': p.token, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: p.bucket, objectName: p.path, contentType: file.type, cacheControl: '3600' },
      onError: (e) => reject(new Error(`Upload failed: ${e.message.split('\n')[0]}`)),
      onProgress: (sent, total) => onProgress(Math.max(1, Math.round((sent / total) * 95))),
      onSuccess: () => resolve(),
    });
    up.start();
  });
}

/** A still frame so a video shows something before it plays and for screen sizes that do not autoplay. */
export function capturePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.playsInline = true; v.src = url;
    const done = (b: Blob | null) => { URL.revokeObjectURL(url); resolve(b); };
    v.onerror = () => done(null);
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const c = document.createElement('canvas'); const w = Math.min(v.videoWidth || 640, 960); c.width = w; c.height = Math.round(w * ((v.videoHeight || 360) / (v.videoWidth || 640)));
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height); c.toBlob((b) => done(b), 'image/jpeg', 0.8);
    };
  });
}

export async function removeMedia(id: string) { await api(`/api/quiz/media/${id}`, { method: 'DELETE' }); }
