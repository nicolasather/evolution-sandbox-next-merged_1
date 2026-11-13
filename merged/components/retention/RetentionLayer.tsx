'use client';
import { useEffect } from 'react';
import type { Engine } from '@/lib/engine';
import { runtime } from '@/lib/retention/runtime';
import { hubUi } from '@/lib/retention/ui';
import type { Unlocks } from '@/lib/unlocks/useUnlocks';
import { CosmeticApplier } from './CosmeticApplier';
import { EggWatcher } from './EggWatcher';
import { EventLayer } from './EventLayer';
import { Hub } from './Hub';
import { NpcEncounter } from './NpcEncounter';
import { ShareCard } from './ShareCard';
import { useNotices, useRetention } from './hooks';
import { RArt } from './RArt';
import { SHOP_BY_ID } from '@/lib/retention/catalog';

/** The optional layer on top of the game. Each part mounts ONLY once its unlock holds (conditional mounting, so no timers,
 *  polls or listeners run for locked features). Coins, stickers and the reaction wheel are not drawn on the bench any more:
 *  they live in the Collection drawer, opened from the top bar. Transient reward notes stay. */
export function RetentionLayer({ engine, version, entered, view, busy, unlocks }: {
  engine: Engine; version: number; entered: boolean; view: string; busy: boolean;
  unlocks: Pick<Unlocks, 'has'>;
}) {
  const r = useRetention();
  const notes = useNotices();
  useEffect(() => { if (!entered) return; return runtime.attach(engine); }, [engine, entered]);
  // "C" opens the Collection when nothing else is up
  useEffect(() => {
    if (!entered) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey && !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) && !document.querySelector('[aria-modal="true"]:not([hidden])')) {
        e.preventDefault(); hubUi.open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entered]);

  const onBench = entered && view === 'work';
  const deco = r.equipped.decoration;
  if (!entered) return null;
  return (
    <>
      <CosmeticApplier />
      {unlocks.has('events') && <EventLayer engine={engine} visible={onBench} />}
      {onBench && deco && SHOP_BY_ID[deco] && <div className="rdeco" aria-hidden="true"><RArt kind="decoration" id={deco} size={96} /></div>}
      {/* The old corner Companion is replaced by the global crew stage (components/characters), mounted once in AppRoot. */}
      {unlocks.has('eggs') && <EggWatcher engine={engine} active={entered} />}
      {unlocks.has('visitors') && <NpcEncounter engine={engine} visible={onBench && !busy} />}
      <div className="rhud">
        <div className="rnotes" aria-live="polite">
          {notes.slice(-2).map(n => (
            <div key={n.key} className={`rnote-i rn-${n.kind}`}><b>{n.title}</b>{n.sub && <span>{n.sub}</span>}{n.coins ? <i className="mono">+{n.coins} ◈</i> : null}</div>
          ))}
        </div>
      </div>
      <Hub engine={engine} version={version} unlocks={unlocks} />
      <ShareCard engine={engine} />
    </>
  );
}
