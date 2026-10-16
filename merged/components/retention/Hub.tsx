'use client';
import { useEffect, useRef } from 'react';
import type { Engine } from '@/lib/engine';
import { hubUi, type HubTab } from '@/lib/retention/ui';
import { retention } from '@/lib/retention/store';
import { retentionBus } from '@/lib/retention/bus';
import { Shop } from './Shop';
import { CameosTab, EventsTab, GoalsTab, JourneyTab, SettingsTab, WhispersTab } from './tabs';
import { useHubUi, useRetention } from './hooks';

const TABS: [HubTab, string][] = [
  ['shop', 'Collection'], ['goals', 'Goals'], ['events', 'Scenarios'], ['cameos', 'Visitors'], ['journey', 'Journey'], ['whispers', 'Whispers'], ['settings', 'Settings'],
];
const sig = () => { const s = retention.get(); return JSON.stringify([s.owned, s.equipped]); };

/** The one drawer for the optional layer. Esc or the backdrop closes it. */
export function Hub({ engine, version }: { engine: Engine; version: number }) {
  const ui = useHubUi();
  const r = useRetention();
  const panel = useRef<HTMLDivElement>(null);
  const opened = useRef('');

  useEffect(() => {
    if (!ui.open) return;
    opened.current = sig();
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); hubUi.close(); }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),input,[tabindex="0"]')].filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      retentionBus.emit({ t: 'signal', name: 'hub-close', id: sig() === opened.current ? 'idle' : 'changed' });
      prev?.focus?.();
    };
  }, [ui.open]);

  if (!ui.open) return null;
  return (
    <div className="rhub-wrap" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) hubUi.close(); }}>
      <div className="rhub" ref={panel} role="dialog" aria-modal="true" aria-label="Collection and goals" tabIndex={-1}>
        <header>
          <h2>Your collection <span className="rcoins mono" title="Personal coins, kept only in this browser">◈ {r.coins}</span></h2>
          <button className="chip" onClick={() => hubUi.close()} aria-label="Close">Close</button>
        </header>
        <nav className="rtabs" role="tablist" aria-label="Sections">
          {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={ui.tab === id} onClick={() => hubUi.tab(id)}>{label}</button>)}
        </nav>
        <div className="rbody">
          {ui.tab === 'shop' && <Shop />}
          {ui.tab === 'goals' && <GoalsTab engine={engine} />}
          {ui.tab === 'events' && <EventsTab engine={engine} />}
          {ui.tab === 'cameos' && <CameosTab engine={engine} />}
          {ui.tab === 'journey' && <JourneyTab engine={engine} />}
          {ui.tab === 'whispers' && <WhispersTab engine={engine} version={version} />}
          {ui.tab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
