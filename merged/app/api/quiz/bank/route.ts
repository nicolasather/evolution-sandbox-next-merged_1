import { z } from 'zod';
import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { isMissingRelation } from '@/lib/quiz/settings-db';
import { questionSchema } from '@/lib/quiz/validation';

const NOT_READY = 'The question bank needs the database update (migration 004). It is saved on this device instead.';

export async function GET() {
  try {
    const user = await currentUser();
    const { data, error } = await serviceDB().from('quiz_bank_items').select('id,question,tags,created_at').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(300);
    if (error) { if (isMissingRelation(error)) return success({ items: [] }); throw new AppError('Could not load the bank', 500); }
    return success({ items: (data ?? []).map((r) => ({ id: r.id, question: r.question, tags: r.tags ?? [], createdAt: r.created_at })) });
  } catch (e) { return failure(e); }
}

const addSchema = z.object({ question: questionSchema, tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]) }).strict();
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'quiz-bank', 60, 600, user.id);
    const v = addSchema.parse(await jsonBody(req));
    const { count } = await serviceDB().from('quiz_bank_items').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
    if ((count ?? 0) >= 500) throw new AppError('The bank holds up to 500 questions. Remove some first.', 403);
    const { data, error } = await serviceDB().from('quiz_bank_items').insert({ owner_id: user.id, kind: v.question.kind, prompt: v.question.prompt, question: v.question, tags: v.tags }).select('id').single();
    if (error) { if (isMissingRelation(error)) throw new AppError(NOT_READY, 503); throw new AppError('Could not save to the bank', 500); }
    return success({ id: data.id }, 201);
  } catch (e) { return failure(e); }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    const id = z.string().uuid().parse(new URL(req.url).searchParams.get('id'));
    const { error } = await serviceDB().from('quiz_bank_items').delete().eq('id', id).eq('owner_id', user.id);
    if (error) throw new AppError('Could not remove it', 500);
    return success({ ok: true });
  } catch (e) { return failure(e); }
}
