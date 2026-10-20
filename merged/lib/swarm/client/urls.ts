/** Where the browser reaches the game server. NEXT_PUBLIC_SWARM_URL is the worker's public HTTP(S) origin (see swarm-server/README.md). */
export const swarmUrl = (): string | null => { const u = (process.env.NEXT_PUBLIC_SWARM_URL ?? '').trim().replace(/\/$/, ''); return u || null; };
export const wsUrlOf = (httpUrl: string) => httpUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
