import { parseWorkerHttpOrigin, workerWsUrl, WorkerUrlError } from '../config';

/** Where the browser reaches the game server. NEXT_PUBLIC_SWARM_URL is the worker's public **https origin** (see swarm-server/README.md). Never wss://:
 *  the same origin serves POST /join (fetch) and the socket address is derived by wsUrlOf(). `process.env.NEXT_PUBLIC_*` must stay a literal read so Next inlines it. */
const rawUrl = () => (process.env.NEXT_PUBLIC_SWARM_URL ?? '').trim();
/** The validated origin, or null when unset or malformed (see swarmUrlProblem for why). */
export const swarmUrl = (): string | null => { const v = rawUrl(); if (!v) return null; try { return parseWorkerHttpOrigin(v); } catch { return null; } };
/** A teacher/owner-facing sentence explaining a bad NEXT_PUBLIC_SWARM_URL, or null when it is fine or simply unset. */
export const swarmUrlProblem = (): string | null => { const v = rawUrl(); if (!v) return null; try { parseWorkerHttpOrigin(v); return null; } catch (e) { return e instanceof WorkerUrlError ? e.message : 'The game server address is invalid.'; } };
/** The WebSocket address (wss://host/ws) for a worker origin. Throws WorkerUrlError for anything that is not a valid origin. */
export const wsUrlOf = (httpUrl: string): string => workerWsUrl(httpUrl);
