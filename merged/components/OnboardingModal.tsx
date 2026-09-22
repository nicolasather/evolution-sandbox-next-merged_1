/**
 * OnboardingModal — Interactive tutorial for new players
 * Guides players through core gameplay mechanics with animations
 */

import React, { useState } from 'react';
import styles from './OnboardingModal.module.css';

interface OnboardingStep {
  title: string;
  description: string;
  visual: 'combine' | 'discover' | 'archive' | 'graph' | 'hints';
  action?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: '🌍 Welcome to Evolution Sandbox',
    description:
      'Discover the history of human innovation by combining simple elements to create complex tools and technologies.',
    visual: 'combine',
    action: 'Combine two items at the bottom to start',
  },
  {
    title: '⚡ Make a Discovery',
    description:
      'When you combine items successfully, you discover something new! Each discovery adds to your knowledge of evolution.',
    visual: 'discover',
    action: 'Watch the reveal animation',
  },
  {
    title: '📚 The Archive',
    description:
      'Your discoveries are saved in the Archive. You can see what you\'ve created, view recipes, and explore multiple crafting paths.',
    visual: 'archive',
    action: 'Click "Archive" to see your discoveries',
  },
  {
    title: '🕸️ The Evolution Graph',
    description:
      'The graph shows how items connect. Nodes represent items, and lines show how they\'re created from other items.',
    visual: 'graph',
    action: 'Click "Graph" to see all connections',
  },
  {
    title: '💡 Need Help? Get Hints',
    description:
      'If you\'re stuck, click the "Need a hint?" button. Hints progress from vague to specific, preserving the joy of discovery.',
    visual: 'hints',
    action: 'Look for hint buttons when selecting items',
  },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasSeenBefore?: boolean;
}

export function OnboardingModal({ isOpen, onClose, hasSeenBefore }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('evo.onboarding.dismissed', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Close button */}
        <button className={styles.closeButton} onClick={handleClose} aria-label="Close onboarding">
          ✕
        </button>

        {/* Step counter */}
        <div className={styles.stepCounter}>
          Step {currentStep + 1} of {ONBOARDING_STEPS.length}
        </div>

        {/* Visual representation */}
        <div className={`${styles.visual} ${styles[`visual-${step.visual}`]}`}>
          {step.visual === 'combine' && (
            <div className={styles.visualContent}>
              <div className={styles.itemPlaceholder}>🪨</div>
              <div className={styles.plus}>+</div>
              <div className={styles.itemPlaceholder}>🌳</div>
              <div className={styles.equals}>=</div>
              <div className={styles.itemPlaceholderLarge}>🪓</div>
            </div>
          )}

          {step.visual === 'discover' && (
            <div className={`${styles.visualContent} ${styles.animating}`}>
              <div className={styles.glyphPlaceholder}>⚡</div>
              <div className={styles.glyphLabel}>Tool Discovered!</div>
            </div>
          )}

          {step.visual === 'archive' && (
            <div className={styles.visualContent}>
              <div className={styles.cardPlaceholder}>
                <div className={styles.cardTitle}>📚 Archive</div>
                <div className={styles.cardItem}>🪓 Tool</div>
                <div className={styles.cardItem}>🔥 Fire</div>
                <div className={styles.cardItem}>⚙️ Machine</div>
              </div>
            </div>
          )}

          {step.visual === 'graph' && (
            <div className={styles.visualContent}>
              <svg className={styles.graphPreview} viewBox="0 0 200 120">
                <circle cx="50" cy="30" r="8" fill="currentColor" />
                <circle cx="150" cy="30" r="8" fill="currentColor" />
                <circle cx="100" cy="90" r="8" fill="currentColor" />
                <line x1="50" y1="30" x2="100" y2="90" stroke="currentColor" strokeWidth="1" />
                <line x1="150" y1="30" x2="100" y2="90" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
          )}

          {step.visual === 'hints' && (
            <div className={styles.visualContent}>
              <div className={styles.hintBox}>
                <div className={styles.hintButton}>💡 Need a hint?</div>
                <div className={styles.hintText}>Hint Level 1: Think about...</div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={styles.content}>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.description}>{step.description}</p>
          {step.action && <p className={styles.action}>→ {step.action}</p>}
        </div>

        {/* Dots indicator */}
        <div className={styles.dotsIndicator}>
          {ONBOARDING_STEPS.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.active : ''}`}
              onClick={() => setCurrentStep(index)}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button
            className={`${styles.button} ${styles.secondary}`}
            onClick={handlePrev}
            disabled={isFirstStep}
            aria-label="Previous step"
          >
            ← Back
          </button>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Don't show again</span>
          </label>

          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={handleNext}
            aria-label={isLastStep ? 'Close onboarding' : 'Next step'}
          >
            {isLastStep ? 'Let\'s Play!' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage onboarding state
 */
export function useOnboarding(forceShow?: boolean) {
  const [isOpen, setIsOpen] = useState(() => {
    if (forceShow) return true;
    if (typeof window === 'undefined') return false;

    const dismissed = localStorage.getItem('evo.onboarding.dismissed');
    const savedGames = localStorage.getItem('evo.sandbox.v1');

    // Show onboarding if:
    // 1. User explicitly hasn't dismissed it
    // 2. User has no saved games (new player)
    return !dismissed && !savedGames;
  });

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
