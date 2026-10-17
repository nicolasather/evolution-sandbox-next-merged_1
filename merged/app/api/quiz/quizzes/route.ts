import { currentUser, maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { saveQuizSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

/** GET /api/quiz/quizzes            → published quizzes (public titles only, no questions, no keys)
 *  GET /api/quiz/quizzes?mine=1     → the signed-in user's own quizzes, drafts included */
export async function GET(req: Request) {
  try {
    const mine = new URL(req.url).searchParams.get('mine') === '1';
    const user = await maybeUser();
    if (mine && !user) throw new AppError('Sign in required', 401);
    let query = serviceDB()
      .from('quizzes')
      .select('id,title,description,status,owner_id,updated_at,quiz_questions(count)')
      .order('updated_at', { ascending: false })
      .limit(100);
    query = mine ? query.eq('owner_id', user!.id) : query.eq('status', 'published');
    const { data, error } = await query;
    if (error) { console.error('[quiz] list', error.code); throw new AppError('Could not load quizzes', 500); }
    const quizzes = (data ?? []).map((q) => ({
      id: q.id, title: q.title, description: q.description, status: q.status, updated_at: q.updated_at,
      questionCount: (q.quiz_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      isMine: user?.id === q.owner_id,
    }));
    return success({ quizzes });
  } catch (e) { return failure(e); }
}

/** Create or update a quiz. The owner is ALWAYS the authenticated user — never a value from the request. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'quiz-save', 60, 600, user.id);
    const parsed = saveQuizSchema.parse(await jsonBody(req));
    const id = await rpc<string>('save_owned_quiz', {
      p_owner: user.id, p_quiz: parsed.id ?? null, p_title: parsed.title, p_description: parsed.description,
      p_status: parsed.status, p_questions: parsed.questions,
    });
    return success({ id }, parsed.id ? 200 : 201);
  } catch (e) { return failure(e); }
}
