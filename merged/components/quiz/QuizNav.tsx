'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/quiz/client';

const LINKS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: '/quiz/modes', label: 'Game Modes', match: (p) => p.startsWith('/quiz/modes') },
  { href: '/quiz/library', label: 'Quiz Library', match: (p) => p.startsWith('/quiz/library') },
  { href: '/quiz/my', label: 'My Quizzes', match: (p) => p.startsWith('/quiz/my') },
  { href: '/quiz/join', label: 'Join a Game', match: (p) => p.startsWith('/quiz/join') },
];

export default function QuizNav({ email, signedIn, guest }: { email: string | null; signedIn: boolean; guest: boolean }) {
  const path = usePathname() ?? '';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // the menu is open only for the page it was opened on, so navigating closes it without an effect
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === path;
  const setOpen = (v: boolean | ((x: boolean) => boolean)) => setOpenPath((cur) => ((typeof v === 'function' ? v(cur === path) : v) ? path : null));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPath(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // The game's custom cursor hides the native pointer with an !important rule inside a CSS layer, which unlayered CSS
  // cannot beat. Quiz Studio keeps the real mouse pointer, so drop that class while a quiz page is showing and put it back on leave.
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains('has-cursor');
    root.classList.remove('has-cursor');
    return () => { if (had) root.classList.add('has-cursor'); };
  }, []);

  async function signOut() {
    if (guest && !window.confirm('Leaving a guest session means you can no longer reach its saved quizzes from this browser. Create an account first to keep them. Leave anyway?')) return;
    setBusy(true);
    try { await api('/api/quiz/auth/signout', { method: 'POST', json: {} }); } finally { setBusy(false); }
    router.push('/quiz');
    router.refresh();
  }
  return (
    <header className="qz-nav" data-open={open}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="qz-nav-inner">
        <Link className="logo" href="/quiz">Quiz Studio</Link>
        <button className="menu-btn" aria-expanded={open} aria-controls="qz-menu" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Menu'}</button>
        <nav id="qz-menu" aria-label="Quiz Studio">
          {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={l.match(path) ? 'page' : undefined}>{l.label}</Link>)}
          {guest && <Link href="/quiz/keep" aria-current={path === '/quiz/keep' ? 'page' : undefined}>Save to an Account</Link>}
          {signedIn ? (
            <button onClick={signOut} disabled={busy} title={guest ? 'Guest session' : `Signed in as ${email}`}>{guest ? 'Leave Guest Session' : 'Sign Out'}</button>
          ) : (
            <Link href="/quiz/login" aria-current={path === '/quiz/login' ? 'page' : undefined}>Sign In</Link>
          )}
          <Link className="cta" href="/quiz/create/mode" aria-current={path.startsWith('/quiz/create') ? 'page' : undefined}>Create a Quiz</Link>
        </nav>
      </div>
    </header>
  );
}
