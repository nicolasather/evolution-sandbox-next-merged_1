'use client';

import { useMemo } from 'react';
import type { Engine } from '@/lib/engine';
import type { StoneAgeTier } from '@/lib/types';
import { cn } from '@/lib/utils';

export function TierProgressBar({ engine }: { engine: Engine }) {
  const progress = useMemo(() => engine.getTierProgress(), [engine]);
  const unlockedTiers = useMemo(() => engine.getUnlockedTiers(), [engine]);

  const tiers: StoneAgeTier[] = ['olduvai', 'middle', 'late'];
  const tierNames: Record<StoneAgeTier, string> = {
    olduvai: 'Olduvai',
    middle: 'Middle',
    late: 'Late',
  };

  return (
    <div className="tier-progress-container" style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>
          Stone Age Progress
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tiers.map(tier => {
          const p = progress[tier];
          const isUnlocked = unlockedTiers.includes(tier);
          const percentage = p.total > 0 ? Math.round((p.unlocked / p.total) * 100) : 0;
          const nextTierThreshold = tier === 'olduvai' ? 50 : tier === 'middle' ? 50 : 100;
          const isNextTierReady = percentage >= nextTierThreshold && tier !== 'late';

          return (
            <div
              key={tier}
              className={cn('tier-progress-item', !isUnlocked && 'locked')}
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: isUnlocked ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)',
                border: `1px solid ${isUnlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                opacity: isUnlocked ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {tierNames[tier]} ({p.unlocked}/{p.total})
                </span>
                <span style={{ opacity: 0.7 }}>{percentage}%</span>
              </div>

              <div
                style={{
                  height: '6px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${percentage}%`,
                    backgroundColor: isUnlocked
                      ? '#4ade80'
                      : isNextTierReady
                        ? '#facc15'
                        : '#ef4444',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {!isUnlocked && tier !== 'olduvai' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                  Unlock {nextTierThreshold}% of previous tier to access
                </div>
              )}

              {isNextTierReady && tier !== 'late' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#facc15', fontWeight: 600 }}>
                  ✓ Ready to unlock next tier
                </div>
              )}

              {isUnlocked && tier !== 'olduvai' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>
                  ✓ Unlocked
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
