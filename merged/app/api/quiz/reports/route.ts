import { z } from 'zod';
import { maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { REPORT_REASONS, REPORT_STATUS_TEXT } from '@/lib/quiz/library';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

const schema = z.object({ quizId: z.string().uuid(), reason: z.enum(REPORT_REASONS), detail: z.string().trim().max(1000).default('') });

/** Anyone may report a published quiz. Reports are rate limited, and the reporter gets a reference and a plain-language status. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const b = schema.parse(await jsonBody(req));
    const user = await maybeUser();
    await rateLimit(req, 'report', 10, 3600, user?.id ?? '');
    const db = serviceDB();
    const { data: quiz } = await db.from('quizzes').select('id,status').eq('id', b.quizId).maybeSingle();
    if (!quiz || quiz.status !== 'published') throw new AppError('Quiz not found', 404);
    const { data, error } = await db.from('content_reports').insert({ quiz_id: b.quizId, reporter_id: user?.id ?? null, reason: b.reason, detail: b.detail }).select('id,status').single();
    if (error) throw new AppError('Reporting is not available yet on this deployment.', 503);
    return success({ reference: data.id.slice(0, 8), status: data.status, message: REPORT_STATUS_TEXT.received }, 201);
  } catch (e) { return failure(e); }
}
