/** Client-side helper for the optional cloud session. Creating a quiz never depends on it: when this says
 *  'unavailable', drafts simply stay on this device (lib/quiz/local-drafts.ts). */
import { api } from './client';

export type SessionInfo = { id: string; email: string | null; guest: boolean };
export type CloudState = { status: 'ready'; user: SessionInfo } | { status: 'unavailable'; reason: string };

const FLAG = 'qz:cloud-unavailable';
let inflight: Promise<CloudState> | null = null;

function flagged(): string | null { try { return sessionStorage.getItem(FLAG); } catch { return null; } }
function setFlag(reason: string) { try { sessionStorage.setItem(FLAG, reason); } catch { /* ignore */ } }

export async function currentSession(): Promise<SessionInfo | null> {
  try { return (await api<{ user: SessionInfo | null }>('/api/quiz/auth/session')).user; } catch { return null; }
}

/** Resolve an existing session, or silently start a guest (Supabase anonymous) session once.
 *  Concurrent callers share one request, so re-renders can never create duplicate anonymous users.
 *  A failure (not configured, anonymous sign-ins switched off, rate limit) is remembered for this tab. */
export function ensureCloudSession(): Promise<CloudState> {
  const known = flagged();
  if (known) return Promise.resolve({ status: 'unavailable', reason: known });
  inflight ??= (async (): Promise<CloudState> => {
    try {
      const existing = await api<{ user: SessionInfo | null }>('/api/quiz/auth/session');
      if (existing.user) return { status: 'ready', user: existing.user };
      await api('/api/quiz/auth/anonymous', { method: 'POST', json: {} });
      const after = await api<{ user: SessionInfo | null }>('/api/quiz/auth/session');
      if (after.user) return { status: 'ready', user: after.user };
      setFlag('no-session');
      return { status: 'unavailable', reason: 'no-session' };
    } catch (e) {
      const reason = (e as Error).message || 'unavailable';
      setFlag(reason);
      return { status: 'unavailable', reason };
    }
  })().finally(() => { inflight = null; });
  return inflight;
}
