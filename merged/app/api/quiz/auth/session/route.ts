import { maybeUser } from '@/lib/quiz/supabase';
import { failure, success } from '@/lib/quiz/api';

export async function GET() {
  try {
    const user = await maybeUser();
    return success({ user: user ? { id: user.id, email: user.email } : null });
  } catch (e) { return failure(e); }
}
