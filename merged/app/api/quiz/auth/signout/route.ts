import { authServer } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, success } from '@/lib/quiz/api';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const client = await authServer();
    await client.auth.signOut();
    return success({ ok: true });
  } catch (e) { return failure(e); }
}
