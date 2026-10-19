import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit } from '@/lib/quiz/api';
import { NextResponse } from 'next/server';

/** Everything this account owns, as one JSON download (quizzes with their keys, media list, cosmetics). Own data only. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'account-export', 5, 3600, user.id);
    const db = serviceDB();
    const { data: quizzes } = await db.from('quizzes').select('*, quiz_questions(*)').eq('owner_id', user.id);
    const media = await db.from('media_assets').select('id,storage_path,mime,bytes,created_at').eq('owner_id', user.id);
    const cosmetics = await db.from('cosmetic_profiles').select('*').eq('owner_id', user.id).maybeSingle();
    const body = JSON.stringify({ format: 'quiz-studio-account-export', version: 1, exportedAt: new Date().toISOString(), quizzes: quizzes ?? [], media: media.data ?? [], cosmetics: cosmetics.data ?? null }, null, 2);
    return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="quiz-studio-export.json"', 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
