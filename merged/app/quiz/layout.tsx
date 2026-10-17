import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './quiz.css';
import QuizNav from '@/components/quiz/QuizNav';
import { maybeUser } from '@/lib/quiz/supabase';
import { quizConfigured } from '@/lib/quiz/config';

export const metadata: Metadata = {
  title: { default: 'Quiz Studio', template: '%s · Quiz Studio' },
  description: 'Build your own quizzes and play them solo, on a classroom projector, or online with a room code.',
};
export const dynamic = 'force-dynamic';

export default async function QuizLayout({ children }: { children: ReactNode }) {
  const configured = quizConfigured();
  let email: string | null = null;
  if (configured) {
    try { email = (await maybeUser())?.email ?? null; } catch { /* treated as signed out */ }
  }
  return (
    <div className="qz">
      <QuizNav email={email} />
      {!configured && (
        <div className="page" style={{ marginBottom: 0 }}>
          <p className="info" role="status">The quiz service is not connected to a database on this deployment yet, so accounts and quizzes are unavailable.</p>
        </div>
      )}
      {children}
      <footer className="qz-footer">Quiz Studio · Classic Quiz · quizzes are created by people like you — none are preloaded</footer>
    </div>
  );
}
