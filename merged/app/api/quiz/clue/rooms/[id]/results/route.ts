import { failure, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { learningReport, loadSession, results } from '@/lib/quiz/cr/server';
import { hostOf, roomIdOf, seatFrom } from '@/lib/quiz/cr/http';

/** Final team results and the learning review. Students get class-level counts only; the host also gets per-student detail for the report. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await roomIdOf(params);
    const host = new URL(req.url).searchParams.get('view') === 'host';
    if (host) await hostOf(id); else await seatFrom(id);
    const row = await loadSession(id);
    if (row.state.phase !== 'finished') throw new AppError('Results are ready when the match ends.', 409);
    return success({ results: await results(id), review: await learningReport(id, host), finish: row.state.finish });
  } catch (e) { return failure(e); }
}
