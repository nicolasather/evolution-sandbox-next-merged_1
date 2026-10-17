import { authServer, currentUser, isGuest } from '@/lib/quiz/supabase';
import { authSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

/** Turn the current guest into a permanent account (email + password) without losing any quiz: the user id stays the same. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    if (!isGuest(user)) throw new AppError('You already have an account.', 409);
    await rateLimit(req, 'auth-upgrade', 10, 3600, user.id);
    const { email, password } = authSchema.parse(await jsonBody(req));
    const client = await authServer();
    const host = req.headers.get('x-forwarded-host') ?? new URL(req.url).host;
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const { error } = await client.auth.updateUser(
      { email, password },
      { emailRedirectTo: `${proto}://${host}/quiz/auth/confirm?next=/quiz/my` },
    );
    if (error) throw new AppError(/registered|exists/i.test(error.message) ? 'An account with that email already exists' : error.message, error.status && error.status < 500 ? error.status : 400);
    return success({ ok: true, needsConfirmation: true });
  } catch (e) { return failure(e); }
}
