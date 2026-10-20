'use client';
/** Join with the 6-character code and a name. No account and no email. The server decides the team and checks the name; the seat is kept in this browser so a reload resumes it. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { swarmUrl, swarmUrlProblem } from '@/lib/swarm/client/urls';
import { persistSeat, lastSeatToken, type Seat } from './seat';

export default function SwarmJoin({ initialCode }: { initialCode: string }) {
  const router = useRouter(); const url = swarmUrl(); const problem = swarmUrlProblem();
  const [code, setCode] = useState(initialCode); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ok = /^[A-Z0-9]{6}$/.test(code) && name.trim().length >= 2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok || !url) return; setBusy(true); setErr('');
    try {
      const resume = lastSeatToken(code);
      const res = await fetch(`${url}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: name.trim(), ...(resume ? { resume } : {}) }) });
      const j = (await res.json().catch(() => ({}))) as { roomId?: string; token?: string; message?: string };
      if (!res.ok || !j.roomId || !j.token) { setErr(j.message ?? 'Could not join. Check the code and try again.'); setBusy(false); return; }
      const seat: Seat = { token: j.token, workerUrl: url, name: name.trim(), code };
      // The match page reads the seat from storage. If the browser refuses to keep it, the seat is held in memory for this tab (persistSeat) and the player screen warns that a reload would lose it.
      persistSeat(j.roomId, seat);
      router.push(`/quiz/swarm/${j.roomId}`);
    } catch (e) { setErr('Could not reach the game server. Check your internet and try again.'); setBusy(false); }
  };
  return (
    <main className="sw narrow" id="main">
      <form className="sw-card" onSubmit={submit}>
        <h1>Join Swarm Survival</h1>
        {!url && <p className="sw-err" role="alert" data-testid="no-server">{problem ? 'The game server address on this site is not valid. Ask your teacher to tell the site owner.' : 'The game server is not set up on this site yet. Ask your teacher.'}</p>}
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
