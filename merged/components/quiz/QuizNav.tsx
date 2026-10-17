'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/quiz/client';

export default function QuizNav({ email, signedIn, guest }: { email: string | null; signedIn: boolean; guest: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const link = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>
  );
  async function signOut() {
    setBusy(true);
    try { await api('/api/quiz/auth/signout', { method: 'POST', json: {} }); } finally { setBusy(false); }
    router.push('/quiz');
    router.refresh();
  }
  return (
    <header className="qz-nav">
      <Link className="logo" href="/quiz">Quiz Studio</Link>
      <nav aria-label="Quiz Studio">
        {link('/quiz/library', 'Library')}
        {link('/quiz/my', 'My Quizzes')}
        {link('/quiz/new', 'Create')}
        {link('/quiz/join', 'Join a game')}
        <Link href="/" title="Back to the home page">⌂ Home</Link>
        {guest && link('/quiz/keep', 'Keep my quizzes')}
        {signedIn ? (
          <button onClick={signOut} disabled={busy} title={guest ? 'Guest session — signing out loses access to your guest quizzes' : `Signed in as ${email}`}>
            {guest ? 'Leave guest session' : 'Sign out'}
          </button>
        ) : (
          link('/quiz/login', 'Sign in')
        )}
      </nav>
    </header>
  );
}
