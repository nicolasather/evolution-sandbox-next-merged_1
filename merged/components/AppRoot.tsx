'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sandbox } from './Sandbox';
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

export function AppRoot() {
  const [mode, setMode] = useState<ModeId>('main-evolution');
  const exitToHub = useCallback(() => setMode('main-evolution'), []);

  if (mode === 'survival') return <SurvivalMode onExit={exitToHub} />;
  return <Sandbox onLaunchMode={setMode} />;
}
