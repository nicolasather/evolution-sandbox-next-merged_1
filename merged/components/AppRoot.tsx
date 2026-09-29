'use client';

import { useCallback, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Sandbox } from './Sandbox';
import { CinematicGate } from './cinematic/CinematicGate';
import { SCENES, type SceneId } from '@/lib/cinematic/scenes';
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

export function AppRoot() {
  const [mode, setModeRaw] = useState<ModeId>('main-evolution');
  /** Every mode opens with its own cinematic (title, 1–3 lines, Space). */
  const [gate, setGate] = useState<SceneId | null>(null);
  const setMode = useCallback((m: ModeId) => {
    setModeRaw(m);
    if (m in SCENES) setGate(m as SceneId);
  }, []);
  /** The mode behind the gate plays its own entrance once the door has opened. */
  const closeGate = useCallback(() => {
    setGate(null);
    const el = document.documentElement;
    el.classList.add('mode-enter');
    window.setTimeout(() => el.classList.remove('mode-enter'), 1600);
  }, []);
  const exitToHub = useCallback(() => setModeRaw('main-evolution'), []);

  let body: ReactNode;
  if (mode === 'survival') body = <SurvivalMode onExit={exitToHub} />;
  else if (mode === 'civilization') body = <CivilizationMode onExit={exitToHub} />;
  else if (mode === 'archaeology') body = <ArchaeologyMode onExit={exitToHub} />;
  else if (mode === 'decipher') body = <DecipherMode onExit={exitToHub} />;
  else if (mode === 'escape-room') body = <EscapeRoomMode onExit={exitToHub} />;
  else if (mode === 'alien-archaeology') body = <AlienArchaeologyMode onExit={exitToHub} />;
  else if (mode === 'reverse-evolution') body = <ReverseEvolutionMode onExit={exitToHub} />;
  else body = <Sandbox onLaunchMode={setMode} />;

  return (
    <>
      {body}
      <CinematicGate scene={gate} onClose={closeGate} />
    </>
  );
}
