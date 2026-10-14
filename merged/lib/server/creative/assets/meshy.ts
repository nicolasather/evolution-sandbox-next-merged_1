import { AssetProviderError, type AssetProvider, type TaskStatus } from './provider';

/* Ticket 090 — Meshy text-to-3D adapter (docs: https://docs.meshy.ai/en/api/text-to-3d, checked 2026-10-14).
   NOT exercised against the live service in this repository: no account/key was provided, so every real-provider
   result is BLOCKED in docs/PHASE2_STATUS.md. It runs only when ASSET_AI_ENABLED=true AND MESHY_API_KEY is set. */

const BASE = 'https://api.meshy.ai';
export const MESHY_VERSION = 'meshy-text-to-3d-v2:preview:latest:poly8k';

export class MeshyProvider implements AssetProvider {
  readonly name = 'meshy';
  readonly version = MESHY_VERSION;
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  private async call(path: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try { res = await this.fetchImpl(BASE + path, { ...init, headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } }); }
    catch (e) { throw new AssetProviderError('network', true, (e as Error)?.name === 'AbortError'); }
    if (res.status === 429 || res.status >= 500) throw new AssetProviderError(`http_${res.status}`, true);
    if (!res.ok) throw new AssetProviderError(`http_${res.status}`, false);   // 400/401/402/404: configuration or credits
    return res.json();
  }

  async submit(prompt: string, signal?: AbortSignal): Promise<{ taskId: string }> {
    const j = await this.call('/openapi/v2/text-to-3d', {
      method: 'POST', signal,
      body: JSON.stringify({ mode: 'preview', prompt: prompt.slice(0, 800), ai_model: 'latest', should_remesh: true, target_polycount: 8000, target_formats: ['glb'] }),
    }) as { result?: unknown };
    if (typeof j.result !== 'string' || !/^[A-Za-z0-9_-]{6,80}$/.test(j.result)) throw new AssetProviderError('bad_task_id', false, true);
    return { taskId: j.result };
  }

  async poll(taskId: string, signal?: AbortSignal): Promise<TaskStatus> {
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(taskId)) throw new AssetProviderError('bad_task_id', false);
    const j = await this.call(`/openapi/v2/text-to-3d/${taskId}`, { method: 'GET', signal }) as { status?: string; progress?: number; model_urls?: { glb?: string }; task_error?: { message?: string } };
    switch (j.status) {
      case 'PENDING': return { state: 'pending', progress: j.progress };
      case 'IN_PROGRESS': return { state: 'running', progress: j.progress };
      case 'SUCCEEDED': return j.model_urls?.glb ? { state: 'succeeded', progress: 100, glbUrl: j.model_urls.glb } : { state: 'failed', error: 'no_glb' };
      case 'FAILED': case 'CANCELED': return { state: 'failed', error: String(j.task_error?.message ?? j.status).slice(0, 200) };
      default: throw new AssetProviderError('unknown_status', true);
    }
  }

  async fetchGlb(url: string, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
    let u: URL;
    try { u = new URL(url); } catch { throw new AssetProviderError('bad_url', false); }
    if (u.protocol !== 'https:' || !(u.hostname === 'meshy.ai' || u.hostname.endsWith('.meshy.ai')) || u.username || u.password) throw new AssetProviderError('untrusted_download_host', false);
    const res = await this.fetchImpl(url, { signal, credentials: 'omit', redirect: 'error' });
    if (!res.ok) throw new AssetProviderError(`download_${res.status}`, res.status >= 500);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > maxBytes) throw new AssetProviderError('too_large', false);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new AssetProviderError('too_large', false);
    return buf;
  }
}
