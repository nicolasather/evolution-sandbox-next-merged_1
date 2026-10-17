'use client';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/quiz/client';

export default function UpgradeForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/quiz/auth/upgrade', { method: 'POST', json: { email, password } });
      setDone(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="panel stack">
        <h1 style={{ fontSize: '2rem' }}>Check your email</h1>
        <p>We sent a confirmation link to <strong>{email}</strong>. Open it to finish — your guest quizzes will then belong to that account, on any device.</p>
        <p className="muted-text">Until you confirm, keep using this browser: signing out or clearing cookies would still lose the guest quizzes.</p>
      </div>
    );
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      <div>
        <p className="eyebrow">Guest session</p>
        <h1 style={{ fontSize: '2.2rem' }}>Keep my quizzes</h1>
        <p className="muted-text">Add an email and password to this guest session. Every quiz you made as a guest stays with you.</p>
      </div>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password (at least 8 characters)<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : 'Create my account'}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
