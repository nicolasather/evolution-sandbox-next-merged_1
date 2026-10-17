import { submitAnswer } from '@/lib/quiz/answer-pipeline';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    await rateLimit(req, 'answer', 300, 60, id);
    const body = (await jsonBody(req)) as Record<string, unknown>;
    return success(await submitAnswer({ ...body, roomId: id }));
  } catch (e) { return failure(e); }
}
