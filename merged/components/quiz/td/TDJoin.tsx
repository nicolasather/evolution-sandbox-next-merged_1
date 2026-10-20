'use client';
/** Join an online Tower Defense match with the 6-character code. No account and no email: the seat lives in a cookie scoped to this room. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import Poster from './Poster';

export default function TDJoin({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ok = /^[A-Z0-9]{6}$/.test(code) && name.trim().length >= 2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok) return; setBusy(true); setErr('');
    try {
      const d = await api<{ roomId: string }>('/api/quiz/td/join', { method: 'POST', json: { joinCode: code, displayName: name.trim() } });
      router.push(`/quiz/td/${d.roomId}`);
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not join. Check the code and try again.'); setBusy(false); }
  };
  return (
    <main className="td narrow">
      <form className="td-panel td-joinform" onSubmit={submit}>
        <Poster mapId="meadow_circuit" ribbon="Your squad is waiting" alt="A Tower Defense map: your squad builds towers beside the lane to stop enemies reaching the fort" />
        <h1 className="td-sign">Join Tower Defense</h1>
        <label className="td-field">Room code<input inputMode="text" autoCapitalize="characters" autoComplete="off" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-describedby="td-code-hint" /></label>
        <p id="td-code-hint" className="td-note">Six letters and numbers, shown on the teacher’s screen.</p>
        <label className="td-field">Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} /></label>
        <p className="td-note">First name or a nickname. Your squad sees it; the projector may hide it.</p>
        {err && <p className="td-why" role="alert">{err}</p>}
        <button className="td-btn primary big" type="submit" disabled={!ok || busy}>{busy ? 'Joining…' : 'Join the match'}</button>
        <p className="td-note">No code? <Link href="/quiz/td/practice">Practice on your own</Link>.</p>
      </form>
    </main>
  );
}
