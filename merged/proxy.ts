// Next.js 16 proxy (formerly "middleware"). Refreshes the Supabase auth cookie for quiz pages and quiz APIs ONLY,
// so every other Evolution Sandbox route is completely unaffected.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  // Validates (and if needed refreshes) the session; the result is deliberately not used for routing decisions here.
  try {
    await Promise.race([
      supabase.auth.getClaims(),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]);
  } catch (e) {
    // Network timeout or Supabase error: continue without blocking request
  }
  return response;
}

export const config = { matcher: ['/quiz/:path*', '/api/quiz/:path*'] };
