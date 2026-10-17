'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/quiz/client';

export default function AuthForm({ next, confirmError }: { next: string; confirmError?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(confirmError ? 'That confirmation link is invalid or has expired. Try signing in, or create the account again.' : '');
  const [notice, setNotice] = useState('');
  const [understood, setUnderstood] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const out = await api<{ needsConfirmation?: boolean }>(`/api/quiz/auth/${mode}`, { method: 'POST', json: { email, password } });
      if (mode === 'signup' && out.needsConfirmation) {
        setNotice('Account created. We sent a confirmation link to your email — open it, then come back and sign in.');
        setMode('signin');
      } else {
        router.push(next);
        router.refresh();
      }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function continueAsGuest() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/quiz/auth/anonymous', { method: 'POST', json: {} });
      router.push(next);
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
    <form className="panel stack" onSubmit={submit} aria-labelledby="auth-title">
      <div>
        <p className="eyebrow">Account</p>
        <h1 id="auth-title" style={{ fontSize: '2.2rem' }}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted-text">An account lets you create, save, publish and host quizzes. Students joining an online game don’t need one.</p>
      </div>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password{mode === 'signup' ? ' (at least 8 characters)' : ''}
        <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}>
        {mode === 'signin' ? 'I need an account' : 'I already have an account'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}
    </form>
    <section className="panel stack" aria-labelledby="guest-title">
      <h2 id="guest-title" style={{ fontSize: '1.4rem' }}>Or continue as a guest</h2>
      <p className="muted-text">Try the editor without an email or password. <strong>Warning:</strong> a guest’s quizzes are saved only in this browser. If you clear cookies, use private browsing, or switch browser or device, you’ll permanently lose access to them. You can turn the guest session into a real account later to keep your quizzes.</p>
      <label style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{ width: 'auto', marginTop: '.25rem' }} />
        <span>I understand my guest quizzes can be lost.</span>
      </label>
      <button type="button" className="btn ghost" disabled={busy || !understood} onClick={continueAsGuest}>Continue as a guest</button>
    </section>
    </div>
  );
}
