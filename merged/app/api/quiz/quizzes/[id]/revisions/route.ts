import { z } from 'zod';
import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, jsonBody, success } from '@/lib/quiz/api';

const idSchema = z.string().uuid();

/** Owner-only list of saved revisions (newest first). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await params).id);
    const user = await currentUser();
    const db = serviceDB();
    const { data: quiz } = await db.from('quizzes').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (!quiz) throw new AppError('Quiz not found', 404);
    const { data, error } = await db.from('quiz_revisions').select('id,label,doc_hash,created_at').eq('quiz_id', id).order('created_at', { ascending: false }).limit(30);
    if (error) return success({ revisions: [], available: false });
    return success({ revisions: data ?? [], available: true });
  } catch (e) { return failure(e); }
}

/** Owner-only: returns a revision's document so the editor can restore it (the editor saves a safety copy first). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = idSchema.parse((await params).id);
    const user = await currentUser();
    const { revisionId } = z.object({ revisionId: z.string().uuid() }).parse(await jsonBody(req));
    const db = serviceDB();
    const { data: quiz } = await db.from('quizzes').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (!quiz) throw new AppError('Quiz not found', 404);
    const { data } = await db.from('quiz_revisions').select('id,label,doc,created_at').eq('id', revisionId).eq('quiz_id', id).maybeSingle();
    if (!data) throw new AppError('Revision not found', 404);
    return success({ revision: data });
  } catch (e) { return failure(e); }
}
