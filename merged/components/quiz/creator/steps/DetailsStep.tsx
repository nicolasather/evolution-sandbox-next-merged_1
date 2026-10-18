'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { COVER_ART, coverArtLabels, coverArtSrc, VISIBILITIES, visibilityLabels } from '@/lib/quiz/settings';
import { GAME_MODES } from '@/lib/quiz/game-modes';
import CoverMedia from '@/components/quiz/media/CoverMedia';
import AdvancedToggle from '../AdvancedToggle';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';

export default function DetailsStep() {
  const c = useCreator();
  const [tagText, setTagText] = useState('');
  const s = c.settings;
  const titleOk = c.title.trim().length > 0;

  function addTag() {
    const t = tagText.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (t && !s.tags.some((x) => x.toLowerCase() === t.toLowerCase()) && s.tags.length < 8) c.patchSettings({ tags: [...s.tags, t] });
    setTagText('');
  }
  if (!c.ready) return <CreatorChrome step="details"><p className="muted-text" role="status">Loading your draft…</p></CreatorChrome>;
  if (!c.draftKey) return <CreatorChrome step="details" canContinue={false} continueHint="Choose a game mode first."><p className="info">Start with <Link href="/quiz/create/mode">choosing a game mode</Link> so your quiz has somewhere to live.</p></CreatorChrome>;
  if (c.missing) return <CreatorChrome step="details" hideContinue><p className="error">This draft could not be found on this device or in your account.</p></CreatorChrome>;

  return (
    <CreatorChrome step="details" canContinue={titleOk} continueHint="Give the quiz a title to continue.">
      <div className="cr-two">
        <section className="panel stack" aria-labelledby="det-h">
          <h2 id="det-h">Quiz details</h2>
          <label>Quiz title (required)
            <input value={c.title} onChange={(e) => c.setTitle(e.target.value)} maxLength={160} placeholder="Give your quiz a title" aria-invalid={!titleOk && c.questions.length > 0 ? true : undefined} aria-describedby="title-count" autoFocus />
            <span id="title-count" className="note">{c.title.length}/160</span>
          </label>
          <label>Description (optional)
            <textarea value={c.description} onChange={(e) => c.setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="What is this quiz about?" aria-describedby="desc-count" />
            <span id="desc-count" className="note">{c.description.length}/2000</span>
          </label>

          <fieldset className="cr-fieldset">
            <legend>Cover</legend>
            <p className="note">Pick an illustration, or upload your own picture or GIF.</p>
            <div className="cr-covers" role="radiogroup" aria-label="Cover illustration">
              {COVER_ART.map((id) => (
                <button key={id} role="radio" aria-checked={s.coverArt === id && !s.coverMediaId} className="cr-cover" aria-label={coverArtLabels[id]} onClick={() => c.patchSettings({ coverArt: id, coverMediaId: undefined, coverAlt: undefined })}>
                  <Image src={coverArtSrc[id]} alt="" width={300} height={186} unoptimized />
                  <span>{coverArtLabels[id]}</span>
                </button>
              ))}
            </div>
            <CoverMedia />
          </fieldset>

          <AdvancedToggle label="More options: subject, grade, tags, visibility" />
          {s.advanced && (
            <div className="stack">
              <div className="grid2">
                <label>Subject (optional)<input value={s.subject} maxLength={60} onChange={(e) => c.patchSettings({ subject: e.target.value })} placeholder="e.g. Biology" /></label>
                <label>Grade or level (optional)<input value={s.grade} maxLength={30} onChange={(e) => c.patchSettings({ grade: e.target.value })} placeholder="e.g. Grades 6–8" /></label>
              </div>
              <div className="stack">
                <label>Tags (optional, up to 8)
                  <span className="row" style={{ flexWrap: 'nowrap' }}>
                    <input value={tagText} maxLength={30} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Type a tag, press Enter" />
                    <button className="btn small ghost" type="button" onClick={addTag} disabled={!tagText.trim() || s.tags.length >= 8}>Add</button>
                  </span>
                </label>
                {s.tags.length > 0 && <ul className="cr-tags" aria-label="Tags">{s.tags.map((t) => <li key={t}><span className="pill">{t}</span><button className="cr-x" aria-label={`Remove tag ${t}`} onClick={() => c.patchSettings({ tags: s.tags.filter((x) => x !== t) })}>✕</button></li>)}</ul>}
              </div>
              <fieldset className="cr-fieldset">
                <legend>Who can open it</legend>
                <div className="stack">{VISIBILITIES.map((v) => (
                  <label key={v} className="inline"><input type="radio" name="vis" checked={s.visibility === v} onChange={() => c.patchSettings({ visibility: v })} /> {visibilityLabels[v]}</label>
                ))}</div>
                <p className="note">You can change this when you publish. Drafts are always private.</p>
              </fieldset>
            </div>
          )}
        </section>

        <aside className="cr-preview-card" aria-label="Library card preview">
          <p className="eyebrow">Library card preview</p>
          <article className="qz-quiz">
            <div className="art"><Image src={coverArtSrc[s.coverArt]} alt="" width={600} height={372} unoptimized /></div>
            <div className="body">
              <h3>{c.title.trim() || 'Untitled quiz'}</h3>
              <p className="muted-text">{c.description.trim() || 'No description yet.'}</p>
              <p className="note">{GAME_MODES[s.gameMode].title} · {c.questions.length} question{c.questions.length === 1 ? '' : 's'}{s.subject ? ` · ${s.subject}` : ''}</p>
            </div>
          </article>
        </aside>
      </div>
    </CreatorChrome>
  );
}
