import type { StorageLike } from '../save';
import type { LockProvider } from '../store';

export class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  failWrites: 'none' | 'quota' | 'blocked' = 'none';
  getItem(k: string): string | null { return this.data.has(k) ? (this.data.get(k) as string) : null; }
  setItem(k: string, v: string): void {
    if (this.failWrites === 'quota') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    if (this.failWrites === 'blocked') throw new Error('SecurityError');
    this.data.set(k, v);
  }
  removeItem(k: string): void { this.data.delete(k); }
}

/** One shared lock between simulated tabs. */
export class FakeLocks {
  owner: object | null = null;
  provider(): LockProvider & { lost?: () => void } {
    const me = {};
    return {
      acquire: async (steal: boolean, onLost: () => void) => {
        if (this.owner && !steal) return false;
        if (this.owner && steal) (this.lostCallbacks.get(this.owner) ?? (() => undefined))();
        this.owner = me; this.lostCallbacks.set(me, onLost); return true;
      },
      release: () => { if (this.owner === me) this.owner = null; },
    };
  }
  lostCallbacks = new Map<object, () => void>();
}
