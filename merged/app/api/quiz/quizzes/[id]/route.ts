import { currentUser, maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { statusSchema } from '@/lib/quiz/validation';
import { publicPayload } from '@/lib/quiz/public';
import { assertSameOrigin, failure, jsonBody, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { z } from 'zod';

const idSchema = z.string().uuid();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await params).id);
    const user = await maybeUser();
    const db = serviceDB();
    const { data: quiz } = await db.from('quizzes').select('id,title,description,status,owner_id,updated_at').eq('id', id).maybeSingle();
    const mine = !!quiz && user?.id === quiz.owner_id;
    if (!quiz || (quiz.status !== 'published' && !mine)) throw new AppError('Quiz not found', 404); // unpublished quizzes look nonexistent to others
    const cols = mine ? 'id,position,kind,prompt,payload,answer_key,base_points' : 'id,position,kind,prompt,payload,base_points';
    const { data: rows, error } = await db.from('quiz_questions').select(cols).eq('quiz_id', id).order('position');
    if (error) throw new AppError('Could not load questions', 500);
    const questions = ((rows ?? []) as unknown as Record<string, any>[]).map((q) => ({
      id: q.id, kind: q.kind, prompt: q.prompt, basePoints: q.base_points,
      payload: mine ? q.payload : publicPayload(q.kind, q.payload, q.id),
      ...(mine ? { answerKey: q.answer_key } : {}),
    }));
    return success({ quiz: { id: quiz.id, title: quiz.title, description: quiz.description, status: quiz.status, updated_at: quiz.updated_at, isMine: mine }, questions });
  } catch (e) { return failure(e); }
}

/** Publish / unpublish without resending the whole quiz. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = idSchema.parse((await params).id);
    const user = await currentUser();
    const { status } = statusSchema.parse(await jsonBody(req));
    const db = serviceDB();
    if (status === 'published') {
      const { count } = await db.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', id);
      if (!count) throw new AppError('Add at least one question before publishing', 400);
    }
    const { data, error } = await db.from('quizzes').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id).select('id');
    if (error) throw new AppError('Could not update the quiz', 500);
    if (!data?.length) throw new AppError('Quiz not found', 404);
    return success({ id, status });
  } catch (e) { return failure(e); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = idSchema.parse((await params).id);
    const user = await currentUser();
    const { data, error } = await serviceDB().from('quizzes').delete().eq('id', id).eq('owner_id', user.id).select('id');
    if (error) throw new AppError('Could not delete the quiz', 500);
    if (!data?.length) throw new AppError('Quiz not found', 404);
    return success({ deleted: true });
  } catch (e) { return failure(e); }
}
