import { NextResponse } from 'next/server';
import { getRoom, isHost, verifyPlayer } from '@/lib/quiz/rooms';
import { loadSessionData } from '@/lib/quiz/report-load';
import { filterSession, misconceptions, modifierImpact, performanceBy, questionStats, reportCsv, reportPdfLines, sessionReport, simplePdf, studentView } from '@/lib/quiz/reports';
import { serviceDB } from '@/lib/quiz/supabase';
import { AppError } from '@/lib/quiz/errors';
import { failure, success } from '@/lib/quiz/api';

const safeName = (s: string) => s.replace(/[^\w-]+/g, '-').slice(0, 40) || 'report';

/** Host: the full session report, optionally filtered, as JSON, CSV or PDF. A player with their token gets only their own answers. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const room = await getRoom(id);
    const { data: quiz } = await serviceDB().from('quizzes').select('title').eq('id', room.quiz_id).maybeSingle();
    const title = (quiz?.title as string | undefined) ?? 'Quiz session';
    const token = req.headers.get('x-player-token');
    if (token && room.mode !== 'classroom') {
      if (room.status !== 'ended') throw new AppError('Results are available when the game ends', 400);
      const player = await verifyPlayer(room, token);
      const view = studentView(await loadSessionData(room, title), player.id);
      if (!view) throw new AppError('No results found', 404);
      return success(view);
    }
    await isHost(id);
    let data = await loadSessionData(room, title);
    const q = url.searchParams;
    data = filterSession(data, { actorId: q.get('actor') ?? undefined, kind: q.get('kind') ?? undefined, difficulty: q.get('difficulty') ?? undefined, topic: q.get('topic') ?? undefined, from: q.get('from') ?? undefined, to: q.get('to') ?? undefined });
    const locale = (q.get('lang') ?? 'en').slice(0, 5);
    const tz = (q.get('tz') ?? 'UTC').slice(0, 60);
    const format = q.get('format');
    if (format === 'csv') return new NextResponse(reportCsv(data, { locale, timeZone: tz }), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${safeName(title)}-report.csv"`, 'Cache-Control': 'no-store' } });
    if (format === 'pdf') return new NextResponse(Buffer.from(simplePdf(title, reportPdfLines(data, locale, tz))), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${safeName(title)}-report.pdf"`, 'Cache-Control': 'no-store' } });
    return success({
      title, report: sessionReport(data), questions: questionStats(data, { role: 'host' }), impact: modifierImpact(data), misconceptions: misconceptions(data),
      byTopic: performanceBy(data, 'topic'), byObjective: performanceBy(data, 'objective'), byDifficulty: performanceBy(data, 'difficulty'), byKind: performanceBy(data, 'kind'),
      status: room.status,
    });
  } catch (e) { return failure(e); }
}
