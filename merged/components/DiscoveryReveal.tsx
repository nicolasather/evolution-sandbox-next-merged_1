/**
 * DiscoveryReveal — Animated reveal of newly discovered items
 *
 * Animation sequence:
 * 1. Ingredients glow and connect (200ms)
 * 2. Result card expands (150ms)
 * 3. Name and glyph fade in (200ms)
 * 4. Glow pulse (optional)
 *
 * Quick, satisfying, non-intrusive.
 */

import React, { useEffect, useState } from 'react';
import type { Discovery } from '@/lib/types';
import styles from './DiscoveryReveal.module.css';

interface DiscoveryRevealProps {
  discovery: Discovery | null;
  isNew: boolean;
  onAnimationEnd?: () => void;
}

export function DiscoveryReveal({ discovery, isNew, onAnimationEnd }: DiscoveryRevealProps) {
  const [stage, setStage] = useState<'idle' | 'connecting' | 'expanding' | 'fadeIn' | 'complete'>('idle');

  useEffect(() => {
    if (!discovery || !isNew) {
      setStage('idle');
      return;
    }

    // Stage 1: Connecting (200ms)
    setStage('connecting');
    const timer1 = setTimeout(() => setStage('expanding'), 200);

    // Stage 2: Expanding (150ms)
    const timer2 = setTimeout(() => setStage('fadeIn'), 350);

    // Stage 3: FadeIn (200ms)
    const timer3 = setTimeout(() => {
      setStage('complete');
      onAnimationEnd?.();
    }, 550);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [discovery, isNew, onAnimationEnd]);

  if (!discovery || !isNew || stage === 'idle') return null;

  return (
    <div className={`${styles.revealContainer} ${styles[stage]}`}>
      {/* Glyph with glow effect */}
      <div className={`${styles.glyph} ${styles.glow}`}>
        {/* This would be replaced with actual glyph SVG */}
        <div className={styles.glyphPlaceholder}>⚡</div>
      </div>

      {/* Discovery name that fades in */}
      <div className={styles.nameContainer}>
        <h2 className={styles.name}>{discovery.n}</h2>
        <p className={styles.category}>{discovery.cat}</p>
      </div>

      {/* Connecting line animation (shows ingredient connection) */}
      {stage === 'connecting' && <div className={styles.connectionLine} />}

      {/* Glow ring that pulses */}
      <div className={styles.glowRing} />
      <div className={styles.glowRing2} />
    </div>
  );
}
