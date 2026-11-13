'use client';
import { useEffect, useRef } from 'react';
import type { Engine } from '@/lib/engine';
import { actionRegistry, type ActionResult } from '@/lib/characters/actions';
import { emitCrew, provideCrewContext } from '@/lib/characters/bus';
import { crewProgress } from '@/lib/characters/progress';
import { benchCanAct, benchMergePair, benchReturnHome, benchReturnItems } from '@/lib/craft/bus';
import { retentionBus } from '@/lib/retention/bus';
import { progressOf } from '@/lib/unlocks/useUnlocks';

/** Renders nothing. Connects the main bench (Main Evolution, and the legacy merge-style Civilization) to the crew:
 *  real progress → who is unlocked, "the game is ready", what makes the player busy, and the narrow bench actions. */
export function BenchCrewLink({ engine, version, active, mode, busy, view, advanced }: {
  engine: Engine; version: number; active: boolean; mode: 'main-evolution' | 'civilization'; busy: boolean; view: string;
  /** the old `companion` unlock (8 discoveries) now gates only the advanced tricks: bench turns and pranks. Kip himself is always here. */
  advanced: boolean;
}) {
  const live = useRef({ busy, view, active });
  useEffect(() => { live.current = { busy, view, active }; });

  // real progress: the roster is DERIVED from it, never from a timer
  useEffect(() => { if (active) crewProgress.report(progressOf(engine)); }, [engine, version, active]);

  // "the game is ready" (after the intro): the crew shows up now, not before
  const announced = useRef(false);
  useEffect(() => {
    if (!active || announced.current) return;
    announced.current = true;
    const t = window.setTimeout(() => { emitCrew(mode, 'app-enter', undefined, 'ui'); if (mode === 'civilization') emitCrew(mode, 'civilization-enter'); }, 900);
    return () => { window.clearTimeout(t); announced.current = false; };
  }, [active, mode]);

  // what only the bench knows about the player
  useEffect(() => provideCrewContext(() => ({ busy: live.current.busy || live.current.view !== 'work', modalOpen: live.current.busy })), []);

  // the narrow, real, reversible actions — registered while the bench is mounted, validated again when they run
  useEffect(() => {
    if (!active || !advanced) return;
    const tried = new Set<string>();
    let planned: [string, string] | null = null;
    const ok = () => live.current.active && live.current.view === 'work' && !live.current.busy && benchCanAct();
    const off = actionRegistry.registerMode(mode, {
      'bench.tryRandomMerge': async (arg): Promise<ActionResult> => {
        if (!ok()) return { ok: false, reason: 'busy' };
        if (arg?.phase !== 'run') {
          const owned = [...engine.found].filter(id => engine.holds(id));
          if (owned.length < 2) return { ok: false, reason: 'no-pair' };
          for (let i = 0; i < 40; i++) {
            const a = owned[Math.floor(Math.random() * owned.length)], b = owned[Math.floor(Math.random() * owned.length)];
            const key = [a, b].sort().join('+');
            if (a === b || tried.has(key)) continue;
            tried.add(key); planned = [a, b];
            return { ok: true, data: { planned: true } };
          }
          return { ok: false, reason: 'no-pair' };
        }
        const pair = planned; planned = null;
        if (!pair || !engine.holds(pair[0]) || !engine.holds(pair[1])) return { ok: false, reason: 'stale' };
        // listen for the REAL result of the normal combine path; this code never decides it
        const outcome = new Promise<'new' | 'known' | 'fail' | 'timeout'>(resolve => {
          const timer = window.setTimeout(() => { off2(); resolve('timeout'); }, 9000);
          const off2 = retentionBus.on(e => {
            if (e.t === 'discovery') { window.clearTimeout(timer); off2(); resolve(e.status === 'new' ? 'new' : 'known'); }
            else if (e.t === 'attempt-fail') { window.clearTimeout(timer); off2(); resolve('fail'); }
          });
        });
        if (!benchMergePair(pair[0], pair[1])) return { ok: false, reason: 'refused' };
        const res = await outcome;
        if (res === 'fail' || res === 'timeout') window.setTimeout(() => { benchReturnItems(pair); }, 1400); // pieces go safely back
        return { ok: true, data: { outcome: res } };
      },
      'bench.returnItemHome': () => {
        if (!ok()) return { ok: false, reason: 'busy' };
        const id = benchReturnHome();
        return id ? { ok: true, data: { itemId: id } } : { ok: false, reason: 'nothing-to-return' };
      },
      'mode.showGuideTarget': () => ({ ok: !!document.querySelector('.guide-glow, .sx-guide') }),
    });
    return off;
  }, [active, advanced, engine, mode]);

  return null;
}
