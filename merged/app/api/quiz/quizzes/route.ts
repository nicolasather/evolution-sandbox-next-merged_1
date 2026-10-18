import { currentUser, isGuest, maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { saveQuizSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { listedInLibrary, loadSettings, saveSettings } from '@/lib/quiz/settings-db';
import { collectMediaIds } from '@/lib/quiz/media/refs';
import { syncQuizMedia } from '@/lib/quiz/media/server';
import { coverArtSrc, normalizeSettings } from '@/lib/quiz/settings';

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
    const settings = await loadSettings((data ?? []).map((q) => q.id as string));
    const quizzes = (data ?? [])
      .filter((q) => mine || listedInLibrary(settings.get(q.id as string)))
      .map((q) => {
        const s = settings.get(q.id as string);
        return {
          id: q.id, title: q.title, description: q.description, status: q.status, updated_at: q.updated_at,
          questionCount: (q.quiz_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
          isMine: user?.id === q.owner_id,
          gameMode: s?.gameMode ?? 'classic_quiz', coverArt: s?.coverArt ?? 'arena', coverSrc: coverArtSrc[s?.coverArt ?? 'arena'],
          tags: s?.tags ?? [], subject: s?.subject ?? '', visibility: s?.visibility ?? 'public',
        };
      });
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
    const id = await rpc<string>('save_owned_quiz', {
      p_owner: user.id, p_quiz: parsed.id ?? null, p_title: parsed.title, p_description: parsed.description,
      p_status: parsed.status, p_questions: parsed.questions,
    });
    // Creator choices live beside the quiz. If migration 004 has not been run, the quiz still saves and we say so.
    const settingsSaved = parsed.settings ? await saveSettings(id, user.id, normalizeSettings(parsed.settings as never)) : true;
    const media = await syncQuizMedia(id, user.id, collectMediaIds(parsed.questions as never, parsed.settings as never));
    return success({ id, settingsSaved, mediaMissing: media.missing }, parsed.id ? 200 : 201);
  } catch (e) { return failure(e); }
}
