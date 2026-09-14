'use client';

import { useMemo } from 'react';
import type { Engine } from '@/lib/engine';
import type { StoneAgeTier } from '@/lib/types';

const tierLabels: Record<StoneAgeTier, { name: string; description: string }> = {
  olduvai: { name: 'Olduvai (Đồ Đá Cũ)', description: 'The foundation of discovery' },
  middle: { name: 'Middle (Đồ Đá Giữa)', description: 'Unlock at 50% of Olduvai' },
  late: { name: 'Late (Đồ Đá Mới)', description: 'Unlock at 50% of Middle' },
  chalcolithic: { name: 'Chalcolithic (Kỷ Nguyên Đồng)', description: 'Unlock at 50% of Late' },
};

export function TierProgressBar({ engine }: { engine: Engine }) {
  const progress = useMemo(() => engine.getTierProgress(), [engine]);
  const unlockedTiers = useMemo(() => engine.getUnlockedTiers(), [engine]);

  return (
    <div style={{ display: 'grid', gridAutoFlow: 'row', gap: '1rem', marginBottom: '1rem' }}>
      {(Object.keys(progress) as StoneAgeTier[]).map(tier => {
        const { total, unlocked } = progress[tier];
        const isUnlocked = unlockedTiers.includes(tier);
        const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
        const label = tierLabels[tier];

        return (
          <div key={tier} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {isUnlocked ? '✓' : '🔒'} {label.name}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, color: 'var(--bone-2)' }}>
                  {label.description}
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, minWidth: '60px', textAlign: 'right' }}>
                {unlocked} / {total}
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bone-1)',
                borderRadius: '4px',
                overflow: 'hidden',
                opacity: isUnlocked ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  backgroundColor: isUnlocked ? 'var(--ochre)' : 'var(--bone-2)',
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
            {!isUnlocked && total > 0 && (
              <div style={{ fontSize: '0.75rem', opacity: 0.6, color: 'var(--bone-2)' }}>
                Need {Math.ceil(total * 0.5)} discoveries to unlock ({percent}% progress)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
