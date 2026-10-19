import { currentUser, isGuest, maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { saveQuizSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, fromDbError, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

/** GET /api/quiz/quizzes            → published quizzes (public titles only, no questions, no keys)
 *  GET /api/quiz/quizzes?mine=1     → the signed-in user's own quizzes, drafts included */
export async function GET(req: Request) {
  try {
    const mine = new URL(req.url).searchParams.get('mine') === '1';
    const user = await maybeUser();
    if (mine && !user) throw new AppError('Sign in required', 401);
    const build = (cols: string) => {
      let query = serviceDB().from('quizzes').select(cols).order('updated_at', { ascending: false }).limit(200);
      query = mine ? query.eq('owner_id', user!.id) : query.eq('status', 'published');
      return query;
    };
    // Prefer the richer columns from migration 004; fall back transparently when it has not been applied.
    let res = await build('id,title,description,status,owner_id,updated_at,meta,review_state,archived_at,quiz_questions(kind)');
    if (res.error) res = await build('id,title,description,status,owner_id,updated_at,quiz_questions(kind)');
    if (res.error) { console.error('[quiz] list', res.error.code); throw new AppError('Could not load quizzes', 500); }
    const quizzes = ((res.data ?? []) as unknown as Record<string, any>[]).filter((q) => mine || !q.archived_at).map((q) => ({
      id: q.id, title: q.title, description: q.description, status: q.status, updated_at: q.updated_at,
      questionCount: (q.quiz_questions as { kind: string }[] | null)?.length ?? 0,
      kinds: [...new Set(((q.quiz_questions as { kind: string }[] | null) ?? []).map((x) => x.kind))],
      isMine: user?.id === q.owner_id, meta: q.meta ?? {}, reviewState: q.review_state ?? 'unreviewed', archived: !!q.archived_at,
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
    if (isGuest(user) && !parsed.id) {
      // guests are anonymous, so cap what one browser can pile up; an account lifts the limit
      const { count } = await serviceDB().from('quizzes').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
      if ((count ?? 0) >= 20) throw new AppError('Guest accounts can keep up to 20 quizzes. Create an account to save more.', 403);
    }
    const base = { p_owner: user.id, p_quiz: parsed.id ?? null, p_title: parsed.title, p_description: parsed.description, p_status: parsed.status, p_questions: parsed.questions };
    // v2 stores quiz-level details and a revision; if migration 004 is not applied yet, fall back to the original save (details are then kept only in the browser draft).
    const v2 = await serviceDB().rpc('save_owned_quiz_v2', { ...base, p_meta: parsed.meta ?? {} });
    if (!v2.error) return success({ id: v2.data as string }, parsed.id ? 200 : 201);
    if (!(v2.error.code === 'PGRST202' || /could not find the function|does not exist/i.test(v2.error.message ?? ''))) throw fromDbError(v2.error);
    const id = await rpc<string>('save_owned_quiz', base);
    return success({ id, metaStored: false }, parsed.id ? 200 : 201);
  } catch (e) { return failure(e); }
}
