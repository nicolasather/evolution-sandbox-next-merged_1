import { authServer, maybeUser, isGuest } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

/** Start a guest session. The person gets a real user id (so quizzes have a persistent owner) but no email or password,
 *  which means the quizzes are only reachable from this browser until the guest upgrades to an account. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const existing = await maybeUser();
    if (existing) return success({ ok: true, guest: isGuest(existing) }); // already signed in: never replace a session
    await rateLimit(req, 'auth-guest', 10, 3600);
    const client = await authServer();
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
      if (error && /anonymous/i.test(error.message + (error.code ?? ''))) {
        throw new AppError('Guest mode is not switched on for this site yet. Please create an account instead.', 400);
      }
      throw new AppError('Could not start a guest session. Please try again or create an account.', error?.status && error.status < 500 ? error.status : 400);
    }
    return success({ ok: true, guest: true }, 201);
  } catch (e) { return failure(e); }
}
