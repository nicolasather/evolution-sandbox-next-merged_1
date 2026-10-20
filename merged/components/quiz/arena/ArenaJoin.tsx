'use client';
/** Join an online Arena Clash match with the 6-character code. No account and no email: the seat lives in an HttpOnly cookie scoped to this room. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';

export default function ArenaJoin({ initialCode }: { initialCode: string }) {
  const router = useRouter(); const [code, setCode] = useState(initialCode); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ok = /^[A-Z0-9]{6}$/.test(code) && name.trim().length >= 2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok) return; setBusy(true); setErr('');
    try { const d = await api<{ roomId: string }>('/api/quiz/arena/join', { method: 'POST', json: { joinCode: code, displayName: name.trim() } }); router.push(`/quiz/arena/${d.roomId}`); }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not join. Check the code and try again.'); setBusy(false); }
  };
  return (
    <main className="ar narrow">
      <form className="ar-card" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static original art */}
        <img className="ar-hero" src="/quiz/arena/art/12_join_lobby.svg" alt="Arena Clash lobby: role cards and a ready button" width={640} height={360} />
        <h1>Join Arena Clash</h1>
        <label className="ar-field">Room code<input inputMode="text" autoCapitalize="characters" autoComplete="off" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-describedby="ar-code-hint" data-testid="ar-join-code" /></label>
        <p id="ar-code-hint" className="ar-note">Six letters and numbers, shown on the teacher’s screen (or scan its QR code).</p>
        <label className="ar-field">Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} data-testid="ar-join-name" /></label>
        <p className="ar-note">First name or a nickname. Your team sees it; rivals and the projector only see a role label.</p>
        {err && <p className="ar-why" role="alert">{err}</p>}
        <button className="ar-btn primary big" type="submit" disabled={!ok || busy} data-testid="ar-join-go">{busy ? 'Joining…' : 'Join the match'}</button>
        <p className="ar-note">No code? <Link href="/quiz/arena/practice">Practice on your own</Link>.</p>
      </form>
    </main>
  );
}
