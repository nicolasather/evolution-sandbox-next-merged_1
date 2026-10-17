'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveToken } from '@/lib/quiz/client';

export default function JoinForm({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const d = await api<{ roomId: string; token: string }>('/api/quiz/rooms/join', { method: 'POST', json: { joinCode: code.trim().toUpperCase(), displayName: name.trim() } });
      saveToken(d.roomId, d.token);
      router.push(`/quiz/play/${d.roomId}`);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form className="panel stack" onSubmit={join}>
      <div><p className="eyebrow">Online multiplayer</p><h1 style={{ fontSize: '2.2rem' }}>Join a game</h1>
        <p className="muted-text">Enter the six-character code your host is showing. No account needed. Classroom projector games don’t use student devices.</p></div>
      <label>Game code
        <input required minLength={6} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC234" style={{ letterSpacing: '.3em', fontSize: '1.4rem', textAlign: 'center' }} />
      </label>
      <label>Your name<input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" /></label>
      <button className="btn" disabled={busy || code.length !== 6 || !name.trim()}>{busy ? 'Joining…' : 'Join room'}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
