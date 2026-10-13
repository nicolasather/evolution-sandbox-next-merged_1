'use client';

import { useCallback, useState } from 'react';
import { SCENES, type SceneId } from '@/lib/cinematic/scenes';
import type { ModeId } from '@/lib/modes/types';
import { useIntroVisit } from './IntroVisit';

/** The scene whose opening belongs to a mode (Minimum Path shares the one the Mode Hub card used). */
export function sceneOfMode(m: ModeId): SceneId | null {
  if (m === 'minimum-path') return 'minpath';
  return m in SCENES ? (m as SceneId) : null;
}

/**
 * The visit-aware gate policy for opening a mode:
 *  - first time in this website visit → the opening plays (and counts as seen the moment it starts,
 *    so skipping it is still "seen");
 *  - every later time → no gate at all: no black frame, no extra click, no hidden overlay;
 *  - `replay` always plays it, and changes neither the visit record nor any progress.
 */
export function useModeGate() {
  const visit = useIntroVisit();
  const [gate, setGate] = useState<SceneId | null>(null);
  /** Returns true when an opening started. */
  const enter = useCallback((m: ModeId): boolean => {
    const scene = sceneOfMode(m);
    if (!scene || visit.hasSeen(scene)) return false;
    visit.markSeen(scene);
    setGate(scene);
    return true;
  }, [visit]);
  const replay = useCallback((m: ModeId) => {
    const scene = sceneOfMode(m);
    if (scene) setGate(scene);
  }, []);
  const close = useCallback(() => setGate(null), []);
  return { gate, enter, replay, close };
}
