import { authServer } from '@/lib/quiz/supabase';
import { authSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'auth-signup', 30, 3600);
    const { email, password } = authSchema.parse(await jsonBody(req));
    const origin = new URL(req.url).origin;
    const client = await authServer();
    const { data, error } = await client.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('x-forwarded-host') ?? new URL(origin).host}/quiz/auth/confirm?next=/quiz/my` },
    });
    if (error) throw new AppError(/registered|exists/i.test(error.message) ? 'An account with that email already exists' : error.message, error.status && error.status < 500 ? error.status : 400);
    // Supabase returns a user with no identities (and no error) for an already-registered email, to avoid leaking which emails exist.
    return success({ ok: true, signedIn: Boolean(data.session), needsConfirmation: !data.session }, 201);
  } catch (e) { return failure(e); }
}
