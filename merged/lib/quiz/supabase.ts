import 'server-only';
import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { publicKey, serviceKey, supabaseUrl } from './config';
import { AppError } from './errors';

let cached: SupabaseClient | null = null;

/** Privileged client. Server only; never reaches the browser bundle (this file imports 'server-only'). */
export function serviceDB(): SupabaseClient {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) throw new AppError('The quiz service is not configured on this deployment.', 503);
  cached ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export async function authServer() {
  const store = await cookies();
  const url = supabaseUrl();
  const key = publicKey();
  if (!url || !key) throw new AppError('The quiz service is not configured on this deployment.', 503);
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Components cannot set cookies; the proxy and route handlers can. */
        }
      },
    },
  });
}

/** Authoritative: asks Supabase Auth to validate the session token. Never trusts anything the browser sends as an owner id. */
export async function currentUser() {
  const client = await authServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AppError('Sign in required', 401);
  return user;
}
export async function maybeUser() {
  try { return await currentUser(); } catch (e) { if (e instanceof AppError && e.status === 503) throw e; return null; }
}
