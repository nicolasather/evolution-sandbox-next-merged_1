'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { WorldDirector } from '@/lib/world/director';
import { startDelay } from '@/lib/world/choreography';
import { eraMoment, inspectMoment, majorMoment, type MomentEnv, type WorldPayload } from '@/lib/world/moments';
import { playback } from '@/lib/world/prefs';
import { notifyWorldDrained, pingWorld, setReplayHandler, setWorldBusy } from '@/lib/world/bus';
import { preloadLand } from '@/lib/world/land';
import { getQuality, isPhone } from '@/lib/perf';
import { sound } from '@/lib/sound';
import { GlobeSequence } from './GlobeSequence';

/* ============================================================================
   WORLD LAYER — the link between the engine and the globe.

   Every time the engine changes, this asks what the world has to announce
   (a major invention, an era finished) and queues a moment for each. It says
   "busy" on the bus while anything is queued, so toasts and the ending wait
   for the picture instead of landing on top of it, and it pings the top-bar
   chip when a place has been registered on the map.

   Nothing here is needed to keep the game correct: progress was saved by the
   engine before this layer heard about it, and a moment that is skipped,
   dropped or never played changes nothing.
   ========================================================================== */

const ENV: MomentEnv = {
  playback: () => playback(),
  quality: () => getQuality(),
  narrow: () => isPhone(),
};

export function WorldLayer({ engine, version, active }: { engine: Engine; version: number; /** The world is live (the film is over). */ active: boolean }) {
  const [director] = useState(() => new WorldDirector<WorldPayload>({
    delay: () => startDelay(getQuality(), playback().motion === 'reduced'),
    open: active,
    onStart: m => {
      if (m.payload.kind === 'major' && !m.payload.inspect) engine.markMajorSeen(m.payload.major.id);
      sound.sfx(m.payload.kind === 'era' ? 'era' : 'major', 0.6);
    },
    onEnd: m => {
      // the place is on the map now
      if (!(m.payload.kind === 'major' && m.payload.inspect)) pingWorld();
    },
    onDrop: m => {
      // an invention that was queued and dropped still counts as seen
      if (m.payload.kind === 'major' && !m.payload.inspect) engine.markMajorSeen(m.payload.major.id);
      pingWorld();
    },
  }));

  // the film, or a dialog, holds the next moment; releasing it lets it play
  useEffect(() => { director.setOpen(active); }, [director, active]);

  // the bus follows the picture: busy while anything is queued or playing, and when it is not, waiting toasts go through
  useEffect(() => director.subscribe(() => {
    setWorldBusy(director.busy);
    if (!director.busy) notifyWorldDrained();
  }), [director]);

  const lastFound = useRef(-1);

  /** Ask the engine what there is to show, and queue it. */
  const drain = useCallback(() => {
    // a game reset: nothing of the old picture should still be on screen
    const found = engine.worldSummary().found;
    if (lastFound.current > found) director.clear();
    lastFound.current = found;

    const events = engine.takeWorldEvents();
    const pb = playback();
    const now = performance.now();
    for (const ev of events) {
      if (ev.kind === 'major') {
        if (ev.tier === 'C') { pingWorld(); continue; }
        if (!pb.enabled) { engine.markMajorSeen(ev.id); pingWorld(); continue; }
        const m = majorMoment(engine, ev, ENV);
        if (m) director.enqueue(m, now);
      } else {
        director.enqueue(eraMoment(engine, ev, ENV), now);
      }
    }
    setWorldBusy(director.busy);
    if (!director.busy) notifyWorldDrained();
  }, [engine, director]);

  useEffect(() => { drain(); }, [version, drain]);

  // replay from the archive
  useEffect(() => {
    setReplayHandler(id => {
      const m = inspectMoment(engine, id, ENV);
      if (!m) return false;
      director.enqueue(m, performance.now());
      setWorldBusy(true);
      return true;
    });
    return () => setReplayHandler(null);
  }, [engine, director]);

  // warm the land texture when the browser is idle
  useEffect(() => { preloadLand(); }, []);

  // leaving the page while something plays must not leave the bus stuck
  useEffect(() => () => { director.clear(); setWorldBusy(false); }, [director]);

  return <GlobeSequence director={director} onSkip={() => { /* state was saved before the first frame: nothing to undo */ }} />;
}
