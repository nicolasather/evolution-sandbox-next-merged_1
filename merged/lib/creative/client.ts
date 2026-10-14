import { releaseHash } from '@/lib/content/releaseManifest';

/* Ticket 071/087 — the browser side of "try a route the book doesn't know". It is OFF unless the owner sets
   NEXT_PUBLIC_CREATIVE_UI=true, it never throws, never blocks play, never touches the save, and the only thing a
   player can ever learn from it is "a possible route is being reviewed" or nothing. */

export type TryOutcome = 'pending_review' | 'nothing';

export const creativeUiEnabled = (): boolean => process.env.NEXT_PUBLIC_CREATIVE_UI === 'true';

const sent = new Set<string>();                 // one request per distinct attempt per page session
let inFlight = 0;
const MAX_IN_FLIGHT = 2;

const rid = (): string => {
  const a = new Uint8Array(12);
  (globalThis.crypto ?? { getRandomValues: (x: Uint8Array) => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(a);
  return 'a' + Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
};

export async function tryRecipeOnServer(
  ingredientIds: readonly string[], actionId: string | null,
  o: { fetchImpl?: typeof fetch; timeoutMs?: number; enabled?: boolean } = {},
): Promise<TryOutcome> {
  if (!(o.enabled ?? creativeUiEnabled())) return 'nothing';
  const key = [...ingredientIds].sort().join(' ') + '|' + (actionId ?? '');
  if (sent.has(key) || inFlight >= MAX_IN_FLIGHT) return 'nothing';
  sent.add(key);
  inFlight++;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), o.timeoutMs ?? 8000);
  try {
    const res = await (o.fetchImpl ?? fetch)('/api/creative/try-recipe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, ingredientIds: [...ingredientIds], actionId, releaseHash, attemptId: rid() }),
      signal: ac.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!res.ok) return 'nothing';
    const j = await res.json() as { kind?: string };
    return j.kind === 'pending_review' ? 'pending_review' : 'nothing';
  } catch {
    return 'nothing';                            // offline, blocked, timeout: normal "nothing happens"
  } finally {
    clearTimeout(timer);
    inFlight--;
  }
}

export const REVIEW_NOTICE = 'A possible route is being reviewed.';
/** test hook */
export const __resetCreativeClient = () => { sent.clear(); inFlight = 0; };
