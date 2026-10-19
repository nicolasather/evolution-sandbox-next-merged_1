'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { devBridge } from '@/lib/dev/bridge';
import { devOverrides } from '@/lib/dev/overrides';
import { profile } from '@/lib/profile/store';
import { ChapterSelect } from './lifelines/ChapterSelect';
import { EntryChoice } from './lifelines/EntryChoice';
import { EntryCinematic } from './lifelines/EntryCinematic';
import { Play } from './lifelines/Play';
import { useLifelines, useReducedMotion } from './lifelines/ui';
import { LegacyCivilization } from './LegacyCivilization';

/* ============================================================================
   CIVILIZATION — Extra Mode `civilization`, now "Lifelines".
   Controller only: entry choice (legacy vs Lifelines) -> chapter list / play.
   The opening cinematic is the app's shared mode gate (components/AppRoot.tsx,
   once per website visit); EntryCinematic below is kept intact and plays only
   on an explicit "Replay intro". The earlier mode stays intact in
   LegacyCivilization and its own `evo.civilization.v1` save is never read for
   writing here.
   ========================================================================== */

type View = 'boot' | 'choice' | 'cinematic' | 'chapters' | 'play' | 'legacy';

export function CivilizationMode({ onExit }: { onExit: () => void }) {
  const { store, snap } = useLifelines();
  const [forced, setForced] = useState<View | null>(null);
  const reduced = useReducedMotion(snap.manifest.settings.motionSpeed);

  useEffect(() => {
    void store.reopen();
    profile.recordModeVisit('civilization');
    return () => { store.detach(); };
  }, [store]);

  // Developer Beta only: the console asked to begin a specific chapter. Nothing ever sets a chapter request
  // outside an authorised beta, so in production this effect never does anything.
  const devRequest = useSyncExternalStore(devBridge.subscribeCiv, devBridge.getCivVersion, () => 0);
  useEffect(() => {
    if (snap.phase !== 'ready' || devRequest === 0 || !devOverrides.isActive()) return;
    const chapterId = devBridge.takeCivChapter();
    if (!chapterId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (store.devStartChapter(chapterId).ok) setForced('play');
  }, [snap.phase, devRequest, store]);

  // The screen is derived from saved state plus the player's explicit choices; no effect sets it.
  const hasLifelines = !!snap.run || Object.keys(snap.manifest.completions).length > 0;
  let view: View;
  if (snap.phase !== 'ready') view = 'boot';
  else if (forced === 'play' && !snap.run) view = 'chapters'; // a finished/archived run returns to the list
  else if (forced) view = forced;
  else if (snap.legacyPresent && !snap.manifest.legacyPromptAnswered && !hasLifelines) view = 'choice';
  // Normal entry goes straight to where the player left off: the opening already played in the shared gate
  // (or was skipped earlier this visit). It never replays a second, internal cinematic by itself.
  else view = snap.run ? 'play' : 'chapters';
  const setView = setForced;

  // The player has now been through the opening (the shared gate, or an earlier visit): remember that,
  // exactly as the old internal cinematic did when it ended. Existing saves keep their value.
  const entrySeen = snap.manifest.entrySeen;
  useEffect(() => {
    if (snap.phase === 'ready' && !entrySeen && view !== 'choice' && view !== 'boot') store.markEntrySeen();
  }, [snap.phase, entrySeen, view, store]);

  const afterCinematic = () => {
    store.markEntrySeen();
    setForced(store.getSnapshot().run ? 'play' : 'chapters');
  };

  if (view === 'legacy') return <LegacyCivilization onExit={onExit} />;

  let body;
  if (snap.phase === 'failed') {
    body = (
      <div className="ll-screen ll-center">
        <h1 className="ll-h1">Lifelines could not load</h1>
        <p className="ll-lede">The content database failed validation ({snap.loadError}). Your saves were not touched.</p>
        <button type="button" className="ll-btn" onClick={onExit}>← Hub</button>
      </div>
    );
  } else if (snap.phase !== 'ready' || view === 'boot') {
    body = <div className="ll-screen ll-center"><p className="ll-eyebrow" role="status">Loading Lifelines…</p></div>;
  } else if (view === 'choice') {
    body = <EntryChoice onExit={onExit} onLegacy={() => { store.markLegacyPromptAnswered(); setView('legacy'); }} onLifelines={() => { store.markLegacyPromptAnswered(); setView(null); }} />;
  } else if (view === 'cinematic') {
    // only reached through "Replay intro": the full original version, whatever the saved entrySeen says
    body = <EntryCinematic first reduced={reduced} onDone={afterCinematic} />;
  } else if (view === 'play' && snap.run) {
    body = <Play key={snap.run.runId} onChapters={() => setView('chapters')} />;
  } else {
    body = <ChapterSelect onPlay={() => setView('play')} onExit={onExit} onLegacy={snap.legacyPresent ? () => setView('legacy') : null} onReplayIntro={() => setView('cinematic')} />;
  }
  return <div id="lifelines-mode" className={'ll-root' + (reduced ? ' reduced' : '') + (snap.manifest.settings.motionSpeed === 'slow' ? ' slow' : '')}>{body}</div>;
}
