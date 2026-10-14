/* ============================================================================
   VISUAL LAB — access gate (development only).

   The lab is open ONLY when ALL of these hold:
     • VISUAL_LAB === 'true' and ENABLE_DEV_TOOLS === 'true'
     • not running on Vercel (VERCEL_ENV production/preview, or VERCEL set outside `vercel dev`)
     • NODE_ENV !== 'production'
     • the request is addressed to a loopback host
   Anything else behaves as if the routes do not exist.
   ========================================================================== */

export interface GateEnv { [k: string]: string | undefined }

export function isLoopbackHostname(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(h);
}

/** `host` header → hostname without port (handles [::1]:3000). */
export function hostnameOf(hostHeader: string | null | undefined): string {
  if (!hostHeader) return '';
  const m = /^\[([^\]]+)\](?::\d+)?$/.exec(hostHeader.trim());
  if (m) return m[1];
  return hostHeader.trim().replace(/:\d+$/, '');
}

/** True on any real Vercel deploy. `VERCEL_ENV=development` alone (it is in .env.example) is a local setting, not Vercel. */
export function onVercel(env: GateEnv): boolean {
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return true;
  return !!env.VERCEL && env.VERCEL_ENV !== 'development';
}

export function labGate(env: GateEnv, hostHeader?: string | null): { open: boolean; reason?: string } {
  if (env.VISUAL_LAB !== 'true') return { open: false, reason: 'VISUAL_LAB is not "true"' };
  if (env.ENABLE_DEV_TOOLS !== 'true') return { open: false, reason: 'ENABLE_DEV_TOOLS is not "true"' };
  if (onVercel(env)) return { open: false, reason: 'running on Vercel' };
  if (env.NODE_ENV === 'production') return { open: false, reason: 'NODE_ENV is production' };
  if (hostHeader !== undefined && !isLoopbackHostname(hostnameOf(hostHeader))) return { open: false, reason: 'request host is not loopback' };
  return { open: true };
}
