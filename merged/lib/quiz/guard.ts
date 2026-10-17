import 'server-only';
import { redirect } from 'next/navigation';
import { quizConfigured } from './config';
import { maybeUser } from './supabase';

/** For server-rendered pages that need a signed-in user: bounce to the sign-in page and return afterwards. */
export async function requireUserOrRedirect(returnTo: string) {
  if (!quizConfigured()) redirect('/quiz');
  const user = await maybeUser();
  if (!user) redirect(`/quiz/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
