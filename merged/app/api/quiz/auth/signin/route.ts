import { authServer } from '@/lib/quiz/supabase';
import { authSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'auth-signin', 20, 600);
    const body = (await jsonBody(req)) as { email?: string; password?: string };
    const { email, password } = authSchema.parse(body);
    const client = await authServer();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      if (/confirm/i.test(error.message)) throw new AppError('Please confirm your email address first — check your inbox.', 403);
      throw new AppError('Incorrect email or password', 401);
    }
    return success({ ok: true, email: data.user.email });
  } catch (e) { return failure(e); }
}
