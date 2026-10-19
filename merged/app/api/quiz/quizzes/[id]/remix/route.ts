import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { remix } from '@/lib/quiz/library';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, rateLimit, rpc, success } from '@/lib/quiz/api';
import type { Question } from '@/lib/quiz/types';

/** Copies a PUBLISHED quiz into the caller's own private draft, with credit to the source. Keys are read server-side and never sent to the browser. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = z.string().uuid().parse((await params).id);
    const user = await currentUser();
    await rateLimit(req, 'remix', 30, 600, user.id);
    const db = serviceDB();
    const { data: quiz } = await db.from('quizzes').select('id,title,description,status').eq('id', id).maybeSingle();
    const { data: own } = await db.from('quizzes').select('owner_id').eq('id', id).maybeSingle();
    const mine = own?.owner_id === user.id; // duplicating your own quiz works for drafts too
    if (!quiz || (quiz.status !== 'published' && !mine)) throw new AppError('Quiz not found', 404);
    const { data: rows } = await db.from('quiz_questions').select('kind,prompt,payload,answer_key,base_points').eq('quiz_id', id).order('position');
    const questions: Question[] = (rows ?? []).map((r) => ({ kind: r.kind, prompt: r.prompt, payload: r.payload, answerKey: r.answer_key, basePoints: r.base_points }) as Question);
    const copy = remix({ id, title: quiz.title, description: quiz.description, questions }, (p) => `${p}${randomUUID().slice(0, 8)}`);
    if (mine) { copy.title = `${quiz.title} (copy)`.slice(0, 160); copy.meta = {} as typeof copy.meta; }
    const base = { p_owner: user.id, p_quiz: null, p_title: copy.title, p_description: copy.description, p_status: 'draft', p_questions: copy.questions };
    const v2 = await db.rpc('save_owned_quiz_v2', { ...base, p_meta: copy.meta });
    const newId = v2.error ? await rpc<string>('save_owned_quiz', base) : (v2.data as string);
    if (!v2.error && !mine) await db.from('quizzes').update({ source_quiz_id: id }).eq('id', newId);
    return success({ id: newId }, 201);
  } catch (e) { return failure(e); }
}
