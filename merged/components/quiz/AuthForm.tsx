'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/quiz/client';
import { ensureCloudSession } from '@/lib/quiz/session-client';

export default function AuthForm({ next, confirmError }: { next: string; confirmError?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(confirmError ? 'That confirmation link is invalid or has expired. Try signing in, or create the account again.' : '');
  const [notice, setNotice] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const out = await api<{ needsConfirmation?: boolean }>(`/api/quiz/auth/${mode}`, { method: 'POST', json: { email, password } });
      if (mode === 'signup' && out.needsConfirmation) {
        setNotice('Account created. We sent a confirmation link to your email — open it, then come back and sign in.');
        setMode('signin');
      } else { router.push(next); router.refresh(); }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  /** No email, no checkbox. A guest session is started silently when the service offers one; otherwise drafts stay on this device. */
  async function withoutEmail() {
    setBusy(true); setError(''); setNotice('');
    try { await ensureCloudSession(); } catch { /* local drafts still work */ }
    router.push('/quiz/create/mode');
    router.refresh();
  }

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Account</p>
        <h1 style={{ fontSize: 'clamp(2.4rem, 8vw, 3.6rem)' }}>Sign In</h1>
        <p className="muted-text">An account keeps your quizzes online and lets you host classroom and online games from any device. Creating and editing quizzes never requires one. Players joining a game don’t need one either.</p>
      </div>

      <form className="panel stack" onSubmit={submit} aria-labelledby="auth-title">
        <div className="tab-row" role="tablist" aria-label="Account action" style={{ marginBottom: 0 }}>
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Sign In</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Create Account</button>
        </div>
        <h2 id="auth-title" className="sr-only">{mode === 'signin' ? 'Sign in with email' : 'Create an account'}</h2>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password{mode === 'signup' ? ' (at least 8 characters)' : ''}
          <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="success" role="status">{notice}</p>}
      </form>

      <section className="panel paper stack" aria-labelledby="guest-title">
        <h2 id="guest-title" style={{ fontSize: '2rem' }}>Continue Without Email</h2>
        <p className="muted-text" style={{ margin: 0 }}>Open the editor right away. Your quizzes are saved in this browser, and you can add an account later without losing them.</p>
        <p className="note" style={{ margin: 0 }}>Browser-only quizzes are not backed up: clearing site data or switching device means losing access to them. Export Backup in the editor saves a copy.</p>
        <div className="row"><button type="button" className="btn" disabled={busy} onClick={withoutEmail}>Continue Without Email</button>
          <Link className="btn ghost" href="/quiz/create/mode" style={{ background: '#fff', color: 'var(--qz-ink)' }}>Create a Quiz</Link></div>
      </section>
    </div>
  );
}
