'use client';

import { useState } from 'react';
import { Glyph } from './Glyph';
import { StatsCounter } from './vengeance/stats-counter';
import { LineHoverLink } from './vengeance/line-hover-link';
import { TierProgressBar } from './TierProgressBar';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { Engine } from '@/lib/engine';
import type { StoneAgeTier } from '@/lib/types';

type Filter = 'all' | 'found' | 'missing' | 'rare' | 'hidden' | 'req' | 'olduvai' | 'middle' | 'late';

const tierNames: Record<StoneAgeTier, string> = {
  olduvai: 'Olduvai (Đồ Đá Cũ)',
  middle: 'Middle (Đồ Đá Giữa)',
  late: 'Late (Đồ Đá Mới)',
};

export function ArchiveView({
  engine, active, onOpen,
}: { engine: Engine; active: boolean; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [era, setEra] = useState<string | null>(null);
  const [showTierProgress, setShowTierProgress] = useState(false);
  const s = engine.stats();
  const { counts } = engine.db;
  const unlockedTiers = engine.getUnlockedTiers();

  let list = engine.db.nodes.slice();
  if (era) list = list.filter(n => n.era === era);
  if (filter === 'found') list = list.filter(n => engine.has(n.id));
  else if (filter === 'missing') list = list.filter(n => !engine.has(n.id));
  else if (filter === 'rare') list = list.filter(n => n.rar === 'rare');
  else if (filter === 'hidden') list = list.filter(n => n.hidden);
  else if (filter === 'req') list = list.filter(n => n.src.includes('source_required'));
  else if (filter === 'olduvai') list = list.filter(n => n.stone_age_tier === 'olduvai');
  else if (filter === 'middle') list = list.filter(n => n.stone_age_tier === 'middle');
  else if (filter === 'late') list = list.filter(n => n.stone_age_tier === 'late');
  list.sort((a, b) => a.no - b.no);

  // numbers count up the first time the archive comes into view (Vengeance UI StatsCounter)
  const stats: [string, React.ReactNode][] = [
    ['core discoveries', <StatsCounter key="c" value={s.core} suffix={` / ${s.coreTotal}`} />],
    ['hidden finds', <StatsCounter key="h" value={s.hidden} suffix={` / ${s.hiddenTotal}`} />],
    ['combinations tried', <StatsCounter key="t" value={s.combos + s.failed} />],
    ['dead ends', <StatsCounter key="d" value={s.failed} />],
    ['eras reached', <StatsCounter key="e" value={s.eras} suffix={` / ${s.eraTotal}`} />],
    ['deepest thing found', s.deepest.n],
  ];

  const filters: [Filter, string][] = [
    ['all', `All ${counts.total}`], ['found', 'Found'],
    ['missing', 'Missing'], ['rare', 'Rare'], ['hidden', 'Hidden'],
    ['req', `Source required ${counts.sourceRequired}`],
  ];

  const tierFilters: [Filter, string][] = [
    ['olduvai', 'Olduvai (27)'],
    ['middle', 'Middle (97)'],
    ['late', 'Late (198)'],
  ];

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-arch" role="tabpanel" aria-label="Archive">
      <div className="arch-head">
        <h2 className="arch-title">Archive</h2>
        <p style={{ color: 'var(--bone-2)', maxWidth: '62ch', margin: 0 }}>
          Everything in the collection, found or not. Undiscovered entries stay closed —
          but you can still see how many are missing, and where they sit.
        </p>
        <div className="arch-stats">
          {stats.map(([k, v]) => (
            <div className="stat" key={k}><b>{v}</b><span className="mono">{k}</span></div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button
          className="chip"
          onClick={() => setShowTierProgress(!showTierProgress)}
          style={{ marginBottom: showTierProgress ? '1rem' : 0 }}
        >
          {showTierProgress ? '▼' : '▶'} Stone Age Progress
        </button>
        {showTierProgress && <TierProgressBar engine={engine} />}
      </div>

      <div className="arch-filters" id="arch-filters">
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, opacity: 0.6 }}>Type:</span>
        {filters.map(([f, label]) => (
          <button key={f} className="chip" data-af={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
        ))}

        <span style={{ width: 14 }} />

        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, opacity: 0.6 }}>Tier:</span>
        {tierFilters.map(([f, label]) => (
          <button
            key={f}
            className={cn('chip', !unlockedTiers.includes(f as StoneAgeTier) && 'locked')}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            title={!unlockedTiers.includes(f as StoneAgeTier) ? 'Unlock by crafting more discoveries' : undefined}
          >
            {!unlockedTiers.includes(f as StoneAgeTier) ? '🔒 ' : ''}{label}
          </button>
        ))}

        <span style={{ width: 14 }} />
        <button className="chip" aria-pressed={!era} onClick={() => setEra(null)}>Every era</button>
        {engine.db.eras.map(e => (
          <button key={e.id} className="chip" aria-pressed={era === e.id} onClick={() => setEra(e.id)}>{e.name}</button>
        ))}
      </div>

      <div className="arch-grid" id="arch-grid">
        {list.map(n => {
          const known = engine.has(n.id);
          const isLocked = n.stone_age_tier && !engine.isRecipeUnlocked(n.id);

          return (
            <button
              key={n.id}
              className={cn('card', !known && 'locked', isLocked && 'tier-locked')}
              data-id={n.id}
              onClick={() => onOpen(n.id)}
              title={isLocked ? `Unlock ${tierNames[n.stone_age_tier!]} to access` : undefined}
              style={
                isLocked
                  ? {
                    opacity: 0.4,
                    cursor: 'not-allowed',
                  }
                  : undefined
              }
            >
              <Glyph node={n} locked={!known} />
              <span className="cm mono">NO. {String(n.no).padStart(3, '0')}</span>
              <span className="cn">{known ? n.n : '—'}</span>
              <span className="cm mono">{engine.db.eras.find(e => e.id === n.era)?.name}</span>
              {n.stone_age_tier && (
                <span
                  className="cm mono"
                  style={{
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    opacity: 0.7,
                    marginTop: '0.25rem',
                  }}
                >
                  {n.stone_age_tier}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mono arch-note">
        Sources last checked <span id="src-checked">{formatDate(engine.db.sourcesChecked)}</span>.
        Each entry links to institutional pages about its subject. Where none has been verified yet,
        the entry says <b>source required</b> and lists only the general references it was written
        from. <LineHoverLink href="/method" variant="slide" className="text-ochre">How this was built →</LineHoverLink>
      </p>
    </section>
  );
}
