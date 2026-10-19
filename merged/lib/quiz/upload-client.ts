/** Browser side of media upload: pre-check → ask the server for a signed upload → PUT straight to private storage → server verifies the stored bytes.
 *  Nothing here is trusted by the server; it exists to give fast, friendly feedback and to survive flaky networks (bounded retries, no duplicate records). */
import { api, ApiError } from './client';
import { BUCKET, MAX_UPLOAD_BYTES, precheckHead } from './media';
import { publicKey, supabaseUrl } from './config';

export type UploadResult = { id: string; path: string; mime: string; bytes: number; remainingBytes: number };
type Init = { id: string; path: string; key: string; token: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Retries only transient failures (network down, 408/425/429/5xx) with exponential backoff; never retries a definite "no". */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 600): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const status = e instanceof ApiError ? e.status : 0;
      const transient = status === 0 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
      if (!transient || i === attempts - 1) break;
      await sleep(baseMs * 2 ** i);
    }
  }
  throw last;
}

export async function uploadMedia(file: File, opts: { alt?: string; onStage?: (s: 'checking' | 'sending' | 'verifying') => void } = {}): Promise<UploadResult> {
  opts.onStage?.('checking');
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const pre = precheckHead(head, file.size);
  if (!pre.ok) throw new Error(pre.message);
  const url = supabaseUrl(); const key = publicKey();
  if (!url || !key) throw new Error('Uploads are not available on this deployment.');
  const init = await withRetry(() => api<Init>('/api/quiz/media', { method: 'POST', json: { action: 'init', size: file.size, ext: pre.ext } }));
  opts.onStage?.('sending');
  const { createClient } = await import('@supabase/supabase-js');
  const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage.from(BUCKET);
  const put = await withRetry(async () => {
    const r = await storage.uploadToSignedUrl(init.key, init.token, file, { contentType: pre.mime, upsert: false });
    // "already exists" after a retry means the first attempt actually landed — that is success for us, finalize decides.
    if (r.error && !/exist|duplicate/i.test(r.error.message)) throw new ApiError(r.error.message || 'Upload failed', 0);
    return r;
  });
  void put;
  opts.onStage?.('verifying');
  return withRetry(() => api<UploadResult>('/api/quiz/media', { method: 'POST', json: { action: 'finalize', id: init.id, alt: opts.alt ?? '' } }), 4, 800);
}

export const MAX_UPLOAD_LABEL = `${(MAX_UPLOAD_BYTES / 1048576).toFixed(0)} MB`;
