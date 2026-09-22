/**
 * HintManager — Progressive hint system for discoveries
 * 4-level vague→specific hints with localStorage persistence
 */

interface Hints {
  l1: string;
  l2: string;
  l3: string;
  l4: string;
}

export interface HintResult {
  level: 1 | 2 | 3 | 4;
  text: string;
  nextLevel: (1 | 2 | 3 | 4) | null;
}

type HintProgress = Record<string, number>;

const STORAGE_KEY = 'evo.hints.v1';

const HINT_TEMPLATES = {
  conceptual: 'Think about something related to {category}.',
  functional: 'This item is used for {purpose}.',
  contextual: 'It appears in the {era} period of human history.',
  strong: 'Try combining {example1} with {example2}.',
};

export class HintManager {
  private progress: HintProgress = {};

  constructor() {
    this.load();
  }

  /**
   * Get current hint for discovery, advance to next level
   */
  getHint(discovery: any): HintResult {
    if (!discovery) return { level: 1, text: '', nextLevel: null };

    const id = discovery.id || '';
    const currentLevel = (this.progress[id] || 0) as 0 | 1 | 2 | 3 | 4;
    const nextLevel = Math.min(currentLevel + 1, 4);

    const hints = discovery.hints || this.generateFallbackHints(discovery);
    const hintsArray = [hints.l1, hints.l2, hints.l3, hints.l4];
    const text = hintsArray[nextLevel - 1] || '';

    // Update progress
    this.progress[id] = nextLevel;
    this.save();

    return {
      level: nextLevel as 1 | 2 | 3 | 4,
      text,
      nextLevel: nextLevel < 4 ? ((nextLevel + 1) as 1 | 2 | 3 | 4) : null,
    };
  }

  /**
   * Get current hint level for discovery (without advancing)
   */
  getHintLevel(discoveryId: string): number {
    return this.progress[discoveryId] || 0;
  }

  /**
   * Generate fallback hints from discovery data
   */
  private generateFallbackHints(discovery: any): Hints {
    const name = discovery.n || 'this discovery';
    const category = discovery.cat || 'tools';
    const era = discovery.tier || 'ancient';

    return {
      l1: `Think about something related to ${category}.`,
      l2: `This discovery appears in the ${era} era.`,
      l3: `It's created by combining basic elements.`,
      l4: `Try combining different materials to discover ${name}.`,
    };
  }

  /**
   * Load progress from localStorage
   */
  load(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      this.progress = saved ? JSON.parse(saved) : {};
    } catch {
      this.progress = {};
    }
  }

  /**
   * Save progress to localStorage
   */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // Silently fail if localStorage unavailable
    }
  }

  /**
   * Reset all hint progress
   */
  resetProgress(): void {
    this.progress = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail
    }
  }
}
