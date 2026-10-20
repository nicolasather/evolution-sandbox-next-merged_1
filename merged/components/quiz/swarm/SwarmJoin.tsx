'use client';
/** Join with the 6-character code and a name. No account and no email. The server decides the team and checks the name; the seat is kept in this browser so a reload resumes it. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { swarmUrl } from '@/lib/swarm/client/urls';
import { seatKey, readSeat, type Seat } from './SwarmPlayer';

export default function SwarmJoin({ initialCode }: { initialCode: string }) {
  const router = useRouter(); const url = swarmUrl();
  const [code, setCode] = useState(initialCode); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ok = /^[A-Z0-9]{6}$/.test(code) && name.trim().length >= 2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok || !url) return; setBusy(true); setErr('');
    try {
      let resume: string | undefined; try { const last = JSON.parse(localStorage.getItem('swarm:last') ?? 'null') as { code: string; roomId: string } | null; if (last?.code === code) resume = readSeat(last.roomId)?.token; } catch { /* none */ }
      const res = await fetch(`${url}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: name.trim(), ...(resume ? { resume } : {}) }) });
      const j = (await res.json().catch(() => ({}))) as { roomId?: string; token?: string; message?: string };
      if (!res.ok || !j.roomId || !j.token) { setErr(j.message ?? 'Could not join. Check the code and try again.'); setBusy(false); return; }
      const seat: Seat = { token: j.token, workerUrl: url, name: name.trim(), code };
      try { localStorage.setItem(seatKey(j.roomId), JSON.stringify(seat)); localStorage.setItem('swarm:last', JSON.stringify({ code, roomId: j.roomId })); } catch { /* private mode: still works this session via state */ }
      router.push(`/quiz/swarm/${j.roomId}`);
    } catch { setErr('Could not reach the game server. Check your internet and try again.'); setBusy(false); }
  };
  return (
    <main className="sw narrow" id="main">
      <form className="sw-card" onSubmit={submit}>
        <h1>Join Swarm Survival</h1>
        {!url && <p className="sw-err" role="alert">The game server is not set up on this site yet. Ask your teacher.</p>}
        <label className="sw-field">Room code<input inputMode="text" autoCapitalize="characters" autoComplete="off" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-describedby="sw-code-hint" data-testid="code" /></label>
        <p id="sw-code-hint" className="sw-note">Six letters and numbers, shown on the teacher’s screen.</p>
        <label className="sw-field">Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} data-testid="name" /></label>
        <p className="sw-note">First name or a nickname. Your team and teacher see it. No email or account needed.</p>
        {err && <p className="sw-err" role="alert" data-testid="join-error">{err}</p>}
        <button className="sw-btn primary big" type="submit" disabled={!ok || busy || !url} data-testid="join">{busy ? 'Joining…' : 'Join the match'}</button>
        <p className="sw-note">No code? <Link href="/quiz/swarm/practice">Practice on your own</Link>.</p>
      </form>
    </main>
  );
}
