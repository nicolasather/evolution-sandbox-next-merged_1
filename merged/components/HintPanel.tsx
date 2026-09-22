/**
 * HintPanel — Shows progressive hints for a discovery
 * - Shows "Need a hint?" button initially
 * - Progressive reveals level 1 → 2 → 3 → 4 on demand
 * - Unobtrusive, allows player to ignore if desired
 */

import React, { useEffect, useState } from 'react';
import type { HintResult } from '@/lib/types';
import styles from './HintPanel.module.css';

interface HintPanelProps {
  hint: HintResult | null;
  onRequestHint: () => void;
  hasMoreHints: boolean;
  isLoading?: boolean;
}

export function HintPanel({ hint, onRequestHint, hasMoreHints, isLoading = false }: HintPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!!hint);

  useEffect(() => {
    if (hint) setIsExpanded(true);
  }, [hint]);

  if (!hint && !hasMoreHints) return null;

  return (
    <div className={styles.hintPanel}>
      {!hint ? (
        <button
          className={styles.hintButton}
          onClick={onRequestHint}
          disabled={isLoading}
          title="Get a hint (Level 1 of 4)"
          aria-label="Request hint"
        >
          <span className={styles.hintIcon}>💡</span>
          {' '}Need a hint?
        </button>
      ) : (
        <div className={`${styles.hintContent} ${styles[`level${hint.level}`]}`}>
          <div className={styles.hintHeader}>
            <span className={styles.hintLevel}>
              Hint {hint.level} of 4
            </span>
            <button
              className={styles.closeHint}
              onClick={() => setIsExpanded(false)}
              aria-label="Dismiss hint"
            >
              ✕
            </button>
          </div>

          <p className={styles.hintText}>{hint.text}</p>

          {hint.nextLevel && (
            <button
              className={styles.nextHintButton}
              onClick={onRequestHint}
              disabled={isLoading}
            >
              Show next hint →
            </button>
          )}

          {!hint.nextLevel && (
            <p className={styles.hintEnd}>
              That&apos;s all the hints. The rest is up to you!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
