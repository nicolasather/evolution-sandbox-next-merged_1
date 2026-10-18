'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { creatorHref } from '@/lib/quiz/creator-steps';
import { type GameModeId } from '@/lib/quiz/compatibility';
import { ALL_GAME_MODES, gameModeDetail } from '@/lib/quiz/game-modes';
import { lastEditedDraft, type LocalDraft } from '@/lib/quiz/local-drafts';
import { defaultSettings, normalizeSettings } from '@/lib/quiz/settings';
import { modeLabels, modifierLabels } from '@/lib/quiz/types';
import ModeDemo from '@/components/quiz/games/ModeDemo';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';

export default function ModeStep() {
  const c = useCreator();
  const router = useRouter();
  const [last, setLast] = useState<LocalDraft | null>(null);
  const [demo, setDemo] = useState<GameModeId | null>(null);
  const [note, setNote] = useState('');
  // device storage only exists in the browser, so the "resume" card is looked up after hydration
  useEffect(() => { const t = setTimeout(() => setLast(!c.draftKey ? lastEditedDraft() : null), 0); return () => clearTimeout(t); }, [c.draftKey]);

  function choose(id: GameModeId, goNext = true) {
    setNote('');
    if (!c.draftKey) {
      const key = c.ensureDraft({ settings: normalizeSettings(defaultSettings(id)) });
      if (goNext) router.push(creatorHref('details', key));
      return;
    }
    const before = c.settings.rules.modifiers;
    const after = normalizeSettings({ ...c.settings, gameMode: id }).rules.modifiers;
    const dropped = before.filter((m) => !after.includes(m));
    c.patchSettings((s) => ({ ...s, gameMode: id }));
    if (dropped.length) setNote(`Switching mode removed rules that don’t work with it: ${dropped.map((m) => modifierLabels[m]).join(', ')}. Your questions are unchanged.`);
    if (goNext) router.push(creatorHref('details', c.draftKey));
  }
  function quick() { choose('classic_quiz', true); }

  const selected = c.draftKey ? c.settings.gameMode : null;
  return (
    <CreatorChrome step="mode" canContinue={!!c.draftKey} continueHint="Pick a game mode to continue.">
      {!c.ready ? <p className="muted-text" role="status">Loading your draft…</p> : c.missing ? (
        <div className="panel stack"><h2>Draft not found</h2><p className="muted-text">This draft isn’t stored in this browser or account. Drafts made without an account live only on the device that made them.</p>
          <div className="row"><Link className="btn" href="/quiz/create/mode">Start a new quiz</Link><Link className="btn ghost" href="/quiz/my">My Quizzes</Link></div></div>
      ) : (
        <>
          <div className="row spread cr-quick">
            <p className="muted-text" style={{ margin: 0, maxWidth: '62ch' }}>Pick the game your quiz will be played as. Question formats and play methods (solo, classroom, online) come later, so this choice is only about the game itself.</p>
            <button className="btn coral" onClick={quick}>Quick Create (Classic Quiz)</button>
          </div>
          {last && !c.draftKey && (
            <div className="info row spread" role="status">
              <span>Continue <strong>{last.title.trim() || 'your untitled quiz'}</strong> — last edited {new Date(last.updatedAt).toLocaleString()}.</span>
              <Link className="btn small" href={creatorHref((last.step as never) ?? 'details', last.key)}>Resume</Link>
            </div>
          )}
          {note && <p className="info" role="status">{note}</p>}
          <div className="cr-modes">
            {ALL_GAME_MODES.map((id, i) => {
              const d = gameModeDetail(id);
              const isSel = selected === id;
              return (
                <article key={id} className="qz-mode cr-mode" style={{ ['--accent' as string]: d.accent }} data-selected={isSel}>
                  <div className="art"><Image src={d.art} alt="" width={1000} height={620} unoptimized priority={i < 2} /></div>
                  <div className="body">
                    <h2 style={{ fontStyle: 'italic', margin: 0 }}>{d.title}{isSel && <span className="pill published" style={{ marginLeft: 10 }}>Selected</span>}</h2>
                    <p>{d.summary}</p>
                    <ol className="cr-loop">{d.loop.map((l) => <li key={l}>{l}</li>)}</ol>
                    <ul className="facts">{d.facts.map((f) => <li key={f}>{f}</li>)}{d.methods.map((m) => <li key={m.method}>{modeLabels[m.method]}</li>)}</ul>
                    <div className="row">
                      <button className="btn" aria-pressed={isSel} onClick={() => choose(id)}>{isSel ? 'Continue with ' + d.title : 'Select ' + d.title}</button>
                      <button className="btn ghost small" aria-expanded={demo === id} onClick={() => setDemo(demo === id ? null : id)}>{demo === id ? 'Hide sample' : 'Try a sample'}</button>
                    </div>
                    {demo === id && <ModeDemo mode={id} />}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </CreatorChrome>
  );
}
