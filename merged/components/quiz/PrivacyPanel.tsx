'use client';
import { useState } from 'react';
import { api } from '@/lib/quiz/client';

/** Privacy and data controls: export everything we hold, or delete the account and its data. */
export default function PrivacyPanel() {
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState('');
  const [scope, setScope] = useState<'uploads' | 'cosmetics' | 'quizzes'>('uploads');
  async function doExport() {
    try { const j = await api('/api/quiz/account/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' })); a.download = 'quiz-studio-export.json'; a.click(); setMsg('Export downloaded.'); }
    catch (e) { setMsg((e as Error).message); }
  }
  async function doDelete() {
    try { await api('/api/quiz/account/delete', { method: 'POST', json: { scope, confirm: true } }); setMsg(`Deleted: ${scope}.`); }
    catch (e) { setMsg((e as Error).message); }
  }
  return (
    <section className="panel" aria-labelledby="priv-h">
      <h2 id="priv-h">Privacy &amp; your data</h2>
      <p>Nicknames and answers are kept only to run and report on a game, then cleaned up on a schedule. Hosts see a short code for players, never IP addresses. You can export or delete your data at any time.</p>
      <button className="btn" onClick={doExport}>Export my data</button>
      <p><label>What to delete <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}><option value="uploads">My uploaded media</option><option value="cosmetics">My collection</option><option value="quizzes">My quizzes</option></select></label></p>
      <p><label>Type DELETE to enable deletion <input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>{' '}
        <button className="btn danger" disabled={confirm !== 'DELETE'} onClick={doDelete}>Delete selected data</button></p>
      <p role="status" aria-live="polite">{msg}</p>
    </section>
  );
}
