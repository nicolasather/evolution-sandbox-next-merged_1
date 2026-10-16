'use client';
import { useEffect, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { runtime } from '@/lib/retention/runtime';
import { hubUi } from '@/lib/retention/ui';
import { SHOP_BY_ID } from '@/lib/retention/catalog';
import { CosmeticApplier } from './CosmeticApplier';
import { Companion } from './Companion';
import { EggWatcher } from './EggWatcher';
import { EventLayer } from './EventLayer';
import { Hub } from './Hub';
import { NpcEncounter } from './NpcEncounter';
import { RArt } from './RArt';
import { ShareCard } from './ShareCard';
import { StickerWheel } from './StickerWheel';
import { useHubUi, useNotices, useRetention } from './hooks';

/** Everything optional that sits on top of the game: coin pill and notices, the sticker wheel, the companion, scenarios, visitors,
 *  secrets, the bench ornament, and the Collection drawer. It only listens to the game and never drives it. */
export function RetentionLayer({ engine, version, entered, view, busy }: { engine: Engine; version: number; entered: boolean; view: string; busy: boolean }) {
  const r = useRetention();
  const ui = useHubUi();
  const notes = useNotices();
  const [wheel, setWheel] = useState(false);
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
  const icon = r.equipped.icon;
  if (!entered) return null;
  return (
    <>
      <CosmeticApplier />
      <EventLayer engine={engine} visible={onBench} />
      {onBench && deco && SHOP_BY_ID[deco] && <div className="rdeco" aria-hidden="true"><RArt kind="decoration" id={deco} size={96} /></div>}
      <Companion engine={engine} visible={onBench && !busy} />
      <EggWatcher engine={engine} active={entered} />
      <NpcEncounter engine={engine} visible={onBench && !busy} />
      <div className="rhud">
        <div className="rnotes" aria-live="polite">
          {notes.slice(-2).map(n => (
            <div key={n.key} className={`rnote-i rn-${n.kind}`}><b>{n.title}</b>{n.sub && <span>{n.sub}</span>}{n.coins ? <i className="mono">+{n.coins} ◈</i> : null}</div>
          ))}
        </div>
        <StickerWheel open={wheel} onClose={() => setWheel(false)} />
        <div className="rpill-row">
          {r.prefs.stickers && <button className="rpill" aria-label="Open reaction wheel" aria-expanded={wheel} onClick={() => setWheel(w => !w)}><RArt kind="stickers" id={r.prefs.sticker ?? 'flint-spark'} size={22} /></button>}
          <button className="rpill" aria-label={`Open your collection. ${r.coins} coins`} aria-expanded={ui.open} onClick={() => (ui.open ? hubUi.close() : hubUi.open())}>
            {icon ? <RArt kind="icons" id={icon} size={20} /> : null}<span className="mono">◈ {r.coins}</span>
          </button>
        </div>
      </div>
      <Hub engine={engine} version={version} />
      <ShareCard engine={engine} />
    </>
  );
}
