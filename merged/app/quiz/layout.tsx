import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './quiz.css';
import QuizNav from '@/components/quiz/QuizNav';
import { isGuest, maybeUser } from '@/lib/quiz/supabase';
import { quizConfigured } from '@/lib/quiz/config';

export const metadata: Metadata = {
  title: { default: 'Quiz Studio', template: '%s · Quiz Studio' },
  description: 'Create quizzes with five question formats, then play them solo, on a classroom projector, or online with a room code.',
};
export const dynamic = 'force-dynamic';

export default async function QuizLayout({ children }: { children: ReactNode }) {
  const configured = quizConfigured();
  let email: string | null = null;
  let signedIn = false;
  let guest = false;
  if (configured) {
    try {
      const u = await maybeUser();
      if (u) { signedIn = true; guest = isGuest(u); email = u.email ?? null; }
    } catch { /* treated as signed out */ }
  }
  return (
    <div className="qz">
      <QuizNav email={email} signedIn={signedIn} guest={guest} />
      {!configured && (
        <div className="notice"><p className="info" role="status">The online quiz service isn’t connected on this deployment. You can still create quizzes: they are saved on this device.</p></div>
      )}
      {guest && (
        <div className="notice">
          <p className="info" role="status">
            <strong>Guest session.</strong> Your quizzes are tied to this browser. Clearing site data or switching device loses access to them.{' '}
            <Link href="/quiz/keep">Save to an account</Link>.
          </p>
        </div>
      )}
      {children}
      <footer className="qz-footer">
        <nav aria-label="Quiz Studio footer">
          <Link href="/quiz">Quiz Studio</Link>
          <Link href="/quiz/modes">Game Modes</Link>
          <Link href="/quiz/library">Quiz Library</Link>
          <Link href="/quiz/create/mode">Create a Quiz</Link>
          <Link href="/quiz/join">Join a Game</Link>
          <Link href="/">Evolution Sandbox</Link>
        </nav>
      </footer>
    </div>
  );
}
