'use client';

import { useCallback, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Sandbox } from './Sandbox';
import { CinematicGate } from './cinematic/CinematicGate';
import { IntroVisitProvider } from './cinematic/IntroVisit';
import { useModeGate } from './cinematic/useModeGate';
import { ModeHelp } from './guide/ModeHelp';
import type { ModeId } from '@/lib/modes/types';

/* ============================================================================
   APP ROOT — the real top-level mode switch. Main Evolution (Sandbox.tsx)
   mounts by default, unchanged, so the protected intro/landing sequence is
   never touched. Only when the player launches a different mode from the
   Mode Hub (inside Sandbox) does this component swap the mounted tree —
   every other mode is a fully separate component tree with no shared UI
   chrome, lazy-loaded so entering Main Evolution never downloads it.
   ========================================================================== */

const SurvivalMode = dynamic(() => import('./survival/SurvivalMode').then(m => m.SurvivalMode), { ssr: false });
const CivilizationMode = dynamic(() => import('./civilization/CivilizationMode').then(m => m.CivilizationMode), { ssr: false });
const ArchaeologyMode = dynamic(() => import('./archaeology/ArchaeologyMode').then(m => m.ArchaeologyMode), { ssr: false });
const DecipherMode = dynamic(() => import('./decipher/DecipherMode').then(m => m.DecipherMode), { ssr: false });
const EscapeRoomMode = dynamic(() => import('./escaperoom/EscapeRoomMode').then(m => m.EscapeRoomMode), { ssr: false });
const AlienArchaeologyMode = dynamic(() => import('./alienarchaeology/AlienArchaeologyMode').then(m => m.AlienArchaeologyMode), { ssr: false });
const ReverseEvolutionMode = dynamic(() => import('./reverseevolution/ReverseEvolutionMode').then(m => m.ReverseEvolutionMode), { ssr: false });

const MinimumPathMode = dynamic(() => import('./minimumpath/MinimumPathMode').then(m => m.MinimumPathMode), { ssr: false });

export function AppRoot() {
  /* The "which openings have played" record lives above the mode switch, so it survives every
     mode unmounting and remounting, and starts empty again on a fresh page load (a new visit). */
  return (
    <IntroVisitProvider>
      <AppRootBody />
    </IntroVisitProvider>
  );
}

function AppRootBody() {
  const [mode, setModeRaw] = useState<ModeId>('main-evolution');
  /** Each mode's cinematic (title, 1–3 lines, Space) plays the first time it is opened in a visit. */
  const { gate, enter, replay, close } = useModeGate();
  const setMode = useCallback((m: ModeId) => {
    setModeRaw(m);
    enter(m); // already seen this visit: goes straight in
  }, [enter]);
  /** The mode behind the gate plays its own entrance once the door has opened. */
  const closeGate = useCallback(() => {
    close();
    const el = document.documentElement;
    el.classList.add('mode-enter');
    window.setTimeout(() => el.classList.remove('mode-enter'), 1600);
  }, [close]);
  const exitToHub = useCallback(() => setModeRaw('main-evolution'), []);

  let body: ReactNode;
  if (mode === 'survival') body = <SurvivalMode onExit={exitToHub} />;
  else if (mode === 'civilization') body = <CivilizationMode onExit={exitToHub} />;
  else if (mode === 'archaeology') body = <ArchaeologyMode onExit={exitToHub} />;
  else if (mode === 'decipher') body = <DecipherMode onExit={exitToHub} />;
  else if (mode === 'escape-room') body = <EscapeRoomMode onExit={exitToHub} />;
  else if (mode === 'alien-archaeology') body = <AlienArchaeologyMode onExit={exitToHub} />;
  else if (mode === 'reverse-evolution') body = <ReverseEvolutionMode onExit={exitToHub} />;
  else if (mode === 'minimum-path') body = <MinimumPathMode onExit={exitToHub} />;
  else body = <Sandbox onLaunchMode={setMode} />;

  return (
    <>
      {body}
      {mode !== 'main-evolution' && !gate && <ModeHelp mode={mode} onReplayIntro={() => replay(mode)} />}
      <CinematicGate scene={gate} onClose={closeGate} />
    </>
  );
}
