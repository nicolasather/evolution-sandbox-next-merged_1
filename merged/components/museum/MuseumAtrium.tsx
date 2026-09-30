'use client';

import type { CSSProperties } from 'react';
import type { Catalog } from '@/lib/museum/history/data';
import { formatYear } from '@/lib/museum/history/timeline';
import type { HistoricalExhibit, Year } from '@/lib/museum/history/types';
import type { HallLayout } from './layout';
import { MotifArt } from './MotifArt';

/* ============================================================================
   THE ATRIUM — the Museum's entrance hall. One building, three distinct
   wings behind three different doorways:

     centre — the HUMANITY MUSEUM: humanity's canonical history, the grand
              portal, lit by the most recent civilisation-defining achievement;
     left   — YOUR OWN HISTORY: the player's personal discoveries;
     right  — RECORDS: what the extra modes' runs produced.

   Plus the dome (world history), the floor path (the Human Story) and a small
   brass plate (the Curator's Ledger). Along the floor, the building's own plan
   shows how far into history the Museum has grown — lit rooms, then dark.
   ========================================================================== */

export type Place = 'atrium' | 'humanity' | 'personal' | 'records' | 'world' | 'ledger';

export function MuseumAtrium({
  cat, year, layout, unseen, headline, personalCount, recordCount, onGo, onStory,
}: {
  cat: Catalog;
  year: Year;
  layout: HallLayout;
  unseen: number;
  headline: HistoricalExhibit | null;
  personalCount: number;
  recordCount: number;
  onGo: (p: Place) => void;
  onStory: () => void;
}) {
  const open = layout.galleries.filter(g => g.status === 'open').length;
  return (
    <div className="at">
      <div className="at-vault" aria-hidden="true" />
      <header className="at-head">
        <p className="mono at-eyebrow">Evolution Sandbox</p>
        <h1 className="at-title">The Museum</h1>
        <p className="at-now">Humanity&rsquo;s timeline stands at <b>{formatYear(year)}</b>.</p>
        {unseen > 0 && <p className="mono at-new">{unseen} {unseen === 1 ? 'achievement has' : 'achievements have'} come into history since you last walked the halls</p>}
      </header>

      <button type="button" className="at-dome" onClick={() => onGo('world')} aria-label="World history: the globe room">
        <svg viewBox="0 0 200 90" aria-hidden="true">
          <path pathLength={1} d="M10 88C10 30 190 30 190 88" />
          <path pathLength={1} d="M40 88C40 46 160 46 160 88" />
          <path pathLength={1} d="M100 34V88M60 44L78 88M140 44L122 88" />
        </svg>
        <span className="mono">World history</span>
      </button>

      <div className="at-portals">
        <button type="button" className="at-portal side personal" onClick={() => onGo('personal')}>
          <span className="at-arch" aria-hidden="true" />
          <span className="at-portal-inner" aria-hidden="true">
            <span className="at-trail">{Array.from({ length: Math.min(9, personalCount) }, (_, i) => <i key={i} style={{ ['--i' as string]: i } as CSSProperties} />)}</span>
          </span>
          <span className="at-portal-label">
            <span className="mono">Personal wing</span>
            <b>Your Own History</b>
            <span>{personalCount} {personalCount === 1 ? 'discovery' : 'discoveries'} of your own</span>
          </span>
        </button>

        <button type="button" className="at-portal main" onClick={() => onGo('humanity')}>
          <span className="at-arch" aria-hidden="true" />
          <span className="at-portal-inner" aria-hidden="true">
            <span className="at-beam" />
            {headline && <MotifArt motif={headline.display.motif} className="at-headline" />}
          </span>
          <span className="at-portal-label">
            <span className="mono">The Humanity Museum</span>
            <b>Humanity&rsquo;s Achievements</b>
            <span>{open} of {cat.galleries.length} galleries open{headline ? ` · most recently: ${headline.title}` : ''}</span>
          </span>
        </button>

        <button type="button" className="at-portal side records" onClick={() => onGo('records')}>
          <span className="at-arch" aria-hidden="true" />
          <span className="at-portal-inner" aria-hidden="true">
            <span className="at-shelves"><i /><i /><i /><i /></span>
          </span>
          <span className="at-portal-label">
            <span className="mono">Mode archives</span>
            <b>Records</b>
            <span>{recordCount} {recordCount === 1 ? 'record' : 'records'} from your runs</span>
          </span>
        </button>
      </div>

      <button type="button" className="at-path" onClick={onStory}>
        <span className="at-path-line" aria-hidden="true" />
        <span className="mono">Follow the Human Story</span>
        <span className="at-path-sub">the great turning points, one after another</span>
      </button>

      <div className="at-plan" aria-label={`Floor plan: ${open} galleries open, more sealed beyond`}>
        {layout.galleries.map(g => (
          <span key={g.gallery.id} className={`at-room is-${g.status}`}
            style={{ flexGrow: Math.max(1, g.x1 - g.x0), ['--hue' as string]: g.gallery.hue, ['--near' as string]: g.nearness } as CSSProperties}
            title={g.status === 'open' ? g.gallery.title : undefined} />
        ))}
      </div>

      <button type="button" className="at-ledger mono" onClick={() => onGo('ledger')}>Curator&rsquo;s ledger</button>
    </div>
  );
}
