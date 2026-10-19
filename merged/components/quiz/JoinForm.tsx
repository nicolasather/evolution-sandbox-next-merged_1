'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api, saveToken } from '@/lib/quiz/client';
import { ICONS, iconSvg } from '@/lib/quiz/cosmetics/catalog';

export default function JoinForm({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const d = await api<{ roomId: string; token: string; status?: string }>('/api/quiz/rooms/join', { method: 'POST', json: { joinCode: code.trim().toUpperCase(), displayName: name.trim(), ...(icon ? { icon } : {}) } });
      saveToken(d.roomId, d.token);
      router.push(`/quiz/play/${d.roomId}`);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="qz-side-art"><Image src="/quiz/art/mode-online.svg" alt="" width={1200} height={675} unoptimized priority /></div>
      <form className="panel stack" onSubmit={join} aria-labelledby="join-h" noValidate>
        <div><p className="eyebrow">Online game</p><h1 id="join-h" style={{ fontSize: 'clamp(2.4rem, 9vw, 3.6rem)' }}>Join a Game</h1>
          <p className="muted-text">Enter the six-character code your host is showing. No account or email needed. Classroom projector games don’t use student devices.</p></div>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}><legend className="eyebrow">1 · Room code</legend>
        <label>Game code (6 characters)
          <input className="join-code" required minLength={6} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" value={code} aria-invalid={error ? true : undefined} aria-describedby={error ? 'join-err' : undefined}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC234" />
        </label>
        <p className="note" style={{ margin: 0 }} aria-live="polite">{code.length}/6 characters</p></fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}><legend className="eyebrow">2 · Display name</legend>
        <label>The name everyone in the room will see<input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" autoComplete="nickname" /></label>
        <p className="note" style={{ margin: 0 }}>Use a first name or a nickname — not your full name.</p></fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}><legend className="eyebrow">3 · Icon (optional)</legend>
          <div className="row" role="radiogroup" aria-label="Choose an icon, or leave empty">
            <button type="button" className="btn small ghost" role="radio" aria-checked={icon === ''} onClick={() => setIcon('')}>None</button>
            {ICONS.filter((i) => i.free).map((i) => (
              <button type="button" key={i.id} role="radio" aria-checked={icon === i.id} aria-label={i.label} title={i.name} className="btn small ghost" onClick={() => setIcon(i.id)} style={{ padding: 4 }}>
                <span aria-hidden style={{ display: 'inline-block', width: 36, height: 36 }} dangerouslySetInnerHTML={{ __html: iconSvg(i.id, { size: 36 }) }} />
              </button>
            ))}
          </div>
          <p className="note" style={{ margin: 0 }}>No account needed. Items you earn by learning can be chosen here once you have an account.</p></fieldset>
        <button className="btn" disabled={busy || code.length !== 6 || !name.trim()}>{busy ? 'Joining…' : 'Join Game'}</button>
        {error && <p className="error" id="join-err" role="alert">{error}</p>}
      </form>
    </div>
  );
}
