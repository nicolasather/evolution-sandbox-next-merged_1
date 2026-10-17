import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { authServer } from '@/lib/quiz/supabase';

/** Target of the confirmation link in Supabase's sign-up email. Supports both token_hash and PKCE code links. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawNext = searchParams.get('next') ?? '/quiz/my';
  const next = rawNext.startsWith('/quiz') && !rawNext.startsWith('//') ? rawNext : '/quiz/my'; // never an open redirect
  const origin = `${request.headers.get('x-forwarded-proto') ?? 'https'}://${request.headers.get('x-forwarded-host') ?? request.nextUrl.host}`;
  try {
    const client = await authServer();
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const code = searchParams.get('code');
    let ok = false;
    if (tokenHash && type) ok = !(await client.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    else if (code) ok = !(await client.auth.exchangeCodeForSession(code)).error;
    if (ok) return NextResponse.redirect(new URL(next, origin));
  } catch { /* fall through */ }
  return NextResponse.redirect(new URL('/quiz/login?error=confirm', origin));
}
