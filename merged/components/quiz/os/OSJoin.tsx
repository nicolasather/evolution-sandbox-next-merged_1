'use client';
/** Join an online Obstacle Survival match with the 6-character code. No account and no email: the seat lives in an HttpOnly cookie scoped to this room. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';

export default function OSJoin({ initialCode }: { initialCode: string }) {
  const router = useRouter(); const [code, setCode] = useState(initialCode); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ok = /^[A-Z0-9]{6}$/.test(code) && name.trim().length >= 2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok) return; setBusy(true); setErr('');
    try { const d = await api<{ roomId: string }>('/api/quiz/os/join', { method: 'POST', json: { joinCode: code, displayName: name.trim() } }); router.push(`/quiz/os/${d.roomId}`); }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not join. Check the code and try again.'); setBusy(false); }
  };
  return (
    <main className="os narrow">
      <form className="os-card" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static original art */}
        <img className="os-hero" src="/quiz/os/art/05_student_lobby.svg" alt="Obstacle Survival lobby: five role cards and a ready button" width={640} height={360} />
        <h1>Join Obstacle Survival</h1>
        <label className="os-field">Room code<input inputMode="text" autoCapitalize="characters" autoComplete="off" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-describedby="os-code-hint" /></label>
        <p id="os-code-hint" className="os-note">Six letters and numbers, shown on the teacher’s screen.</p>
        <label className="os-field">Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} /></label>
        <p className="os-note">First name or a nickname. Your squad sees it; the projector may hide it.</p>
        {err && <p className="os-why" role="alert">{err}</p>}
        <button className="os-btn primary big" type="submit" disabled={!ok || busy}>{busy ? 'Joining…' : 'Join the match'}</button>
        <p className="os-note">No code? <Link href="/quiz/os/practice">Practice on your own</Link>.</p>
      </form>
    </main>
  );
}
