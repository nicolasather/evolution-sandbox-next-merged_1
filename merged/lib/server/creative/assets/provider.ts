import { buildGlb, mockGeometry } from '@/lib/visual3d/glb';

/* Ticket 090 — the 3D provider boundary. Submitting and polling are SEPARATE short calls, so a serverless
   handler never waits minutes for a model. The mock is the default; the real adapter exists only behind a flag. */

export type TaskState = 'pending' | 'running' | 'succeeded' | 'failed';
export interface TaskStatus { state: TaskState; progress?: number; glbUrl?: string; error?: string }

export class AssetProviderError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly billableUnknown = false) { super(message); this.name = 'AssetProviderError'; }
}

export interface AssetProvider {
  readonly name: string;
  readonly version: string;
  submit(prompt: string, signal?: AbortSignal): Promise<{ taskId: string }>;
  poll(taskId: string, signal?: AbortSignal): Promise<TaskStatus>;
  fetchGlb(url: string, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array>;
}

/** Deterministic, offline, free. `readyAfterPolls` simulates a slow provider; `fail` simulates outages. */
export class MockAssetProvider implements AssetProvider {
  readonly name = 'mock';
  readonly version = 'mock-1';
  submits = 0; polls = 0; fetches = 0;
  private polled = new Map<string, number>();
  constructor(private o: { readyAfterPolls?: number; failSubmit?: AssetProviderError; failTask?: boolean; corrupt?: boolean } = {}) {}
  async submit(prompt: string): Promise<{ taskId: string }> {
    if (this.o.failSubmit) throw this.o.failSubmit;
    this.submits++;
    return { taskId: `mock_${this.submits}_${Math.abs(hash(prompt)) % 1e6}` };
  }
  async poll(taskId: string): Promise<TaskStatus> {
    this.polls++;
    const n = (this.polled.get(taskId) ?? 0) + 1;
    this.polled.set(taskId, n);
    if (this.o.failTask) return { state: 'failed', error: 'mock failure' };
    if (n <= (this.o.readyAfterPolls ?? 0)) return { state: 'running', progress: n * 10 };
    return { state: 'succeeded', progress: 100, glbUrl: `https://mock.invalid/${taskId}.glb` };
  }
  async fetchGlb(url: string): Promise<Uint8Array> {
    this.fetches++;
    if (this.o.corrupt) return new Uint8Array(64).fill(7);
    const g = mockGeometry(Math.abs(hash(url)));
    return buildGlb(g.positions, g.indices);
  }
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }
