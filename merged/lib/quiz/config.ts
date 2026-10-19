/** One place that resolves Supabase configuration. Accepts the modern (publishable / secret) and legacy (anon / service_role) key names. */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}
export function publicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
}
/** SERVER ONLY. Never import this from a client component. */
export function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || undefined;
}
export function quizConfigured(): boolean {
  return Boolean(supabaseUrl() && publicKey() && serviceKey());
}
