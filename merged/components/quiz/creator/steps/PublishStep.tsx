'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { VISIBILITIES, visibilityLabels, type Visibility } from '@/lib/quiz/settings';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';

export default function PublishStep() {
  const c = useCreator();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  if (!c.ready) return <CreatorChrome step="publish"><p className="muted-text" role="status">Loading your draft…</p></CreatorChrome>;
  if (!c.draftKey) return <CreatorChrome step="publish" hideContinue><p className="info">Start with <Link href="/quiz/create/mode">choosing a game mode</Link>.</p></CreatorChrome>;

  const saved = !!c.quizId;
  const published = saved && c.status === 'published';
  const link = typeof window !== 'undefined' && c.quizId ? `${window.location.origin}/quiz/setup/${c.quizId}` : '';
  const cloudDown = c.cloudNote !== '';

  async function saveDraft() { setBusy(true); setNote(''); const ok = await c.persist('draft'); setNote(ok ? '' : 'Could not save. Your work is still on this device.'); setBusy(false); }
  async function publish() { setBusy(true); setNote(''); const ok = await c.persist('publish'); setBusy(false); if (!ok) setNote('Not published. See the message above for why.'); }

  return (
    <CreatorChrome step="publish" hideContinue>
      <div className="cr-two">
        <section className="panel stack" aria-labelledby="pb-h">
          <h2 id="pb-h">Ready to publish?</h2>
          {c.blockers.length > 0 ? (
            <div className="info" role="status"><strong>Fix these first:</strong><ul>{c.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>
          ) : <p className="success" role="status">Everything needed is filled in.</p>}

          <fieldset className="cr-fieldset">
            <legend>Who can open it</legend>
            <div className="stack" role="radiogroup" aria-label="Visibility">
              {VISIBILITIES.map((v) => (
                <label key={v} className="cr-radio"><input type="radio" name="vis" checked={c.settings.visibility === v} onChange={() => c.patchSettings({ visibility: v as Visibility })} /> {visibilityLabels[v]}</label>
              ))}
            </div>
          </fieldset>

          <div className="row">
            <button className="btn ghost" onClick={saveDraft} disabled={busy}>Save draft</button>
            <button className="btn" onClick={publish} disabled={busy || c.blockers.length > 0}>{busy ? 'Working…' : published ? 'Publish changes' : 'Publish'}</button>
            <button className="btn ghost" onClick={c.backup}>Download backup file</button>
          </div>
          {note && <p className="error" role="alert">{note}</p>}
          {c.error && <p className="error" role="alert">{c.error}</p>}
          <p className="note" role="status">{c.save.msg}</p>
          {c.guest && <p className="info">You are using a guest session. Your quiz is kept in this browser; <Link href="/quiz/keep">create an account to keep it on any device</Link>. No account is needed to play or host.</p>}
          {cloudDown && <p className="info">{c.cloudNote}</p>}
        </section>

        <section className="panel stack" aria-labelledby="sh-h">
          <h2 id="sh-h">Share and host</h2>
          {!published ? <p className="muted-text">Publish first to get a link and to host a game. Nothing is shared until you publish.</p> : (
            <>
              <p className="success" role="status">Published. {c.settings.visibility === 'public' ? 'It appears in the Quiz Library.' : c.settings.visibility === 'unlisted' ? 'Only people with the link can open it.' : 'Only you can open it.'}</p>
              {c.settings.visibility !== 'private' && (
                <label>Link<span className="row" style={{ flexWrap: 'nowrap' }}>
                  <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                  <button className="btn small" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setNote('Copy failed — select the link and copy it.'); } }}>{copied ? 'Copied' : 'Copy'}</button>
                </span></label>
              )}
              <div className="row">
                <button className="btn" onClick={() => router.push(`/quiz/setup/${c.quizId}`)}>Set up a game and host it</button>
                <Link className="btn ghost" href="/quiz/my">My quizzes</Link>
              </div>
              <p className="note">Hosting opens the game settings pre-filled from the rules you chose.</p>
            </>
          )}
        </section>
      </div>
    </CreatorChrome>
  );
}
