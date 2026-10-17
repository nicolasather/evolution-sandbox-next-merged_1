/** Small fetch helper shared by the quiz client components. */
export class ApiError extends Error {
  status: number; stage?: number;
  constructor(message: string, status: number, stage?: number) { super(message); this.status = status; this.stage = stage; }
}
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    cache: 'no-store',
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.stage);
  return data as T;
}

export function tokenKey(roomId: string) { return `qz:room:${roomId}:token`; }
export function readToken(roomId: string): string | null {
  try { return localStorage.getItem(tokenKey(roomId)) ?? sessionStorage.getItem(tokenKey(roomId)); } catch { return null; }
}
export function saveToken(roomId: string, token: string) {
  try { localStorage.setItem(tokenKey(roomId), token); } catch { try { sessionStorage.setItem(tokenKey(roomId), token); } catch { /* private mode */ } }
}
