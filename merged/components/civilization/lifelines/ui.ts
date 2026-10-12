'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { lifelinesStore, type LifelinesStore, type Snapshot } from '@/lib/civilization/lifelines/store';
import type { ResourceId } from '@/lib/civilization/lifelines/schema';

/** The shared store plus its current snapshot; re-renders on every store change. */
export function useLifelines(): { store: LifelinesStore; snap: Snapshot } {
  const store = lifelinesStore();
  useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
  return { store, snap: store.getSnapshot() };
}

/** True when the OS asks for reduced motion OR the player chose instant motion. */
export function useReducedMotion(motionSpeed: 'normal' | 'slow' | 'instant'): boolean {
  const [os, setOs] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setOs(q.matches);
    apply();
    q.addEventListener?.('change', apply);
    return () => q.removeEventListener?.('change', apply);
  }, []);
  return os || motionSpeed === 'instant';
}

export const RES_GLYPH: Record<ResourceId, string> = {
  food: 'F', water: 'W', materials: 'M', energy: 'E', knowledge: 'K', health: 'H',
  shelter: 'S', logistics: 'L', ecology: 'Y', trust: 'T', culture: 'C', resilience: 'R',
};
export const RES_HUE: Record<ResourceId, number> = {
  food: 88, water: 200, materials: 30, energy: 48, knowledge: 262, health: 350,
  shelter: 22, logistics: 180, ecology: 140, trust: 320, culture: 290, resilience: 165,
};
export const resColor = (r: ResourceId): string => `hsl(${RES_HUE[r]} 62% 62%)`;

export function seasonLabel(turn: number): string {
  const names = ['Thaw', 'Growth', 'Harvest', 'Rest'];
  return `Season ${turn} · ${names[turn % 4]}`;
}

/** Tag a focusable element so overlays can restore focus when they close. */
export function useRestoreFocus(): void {
  useEffect(() => {
    const prev = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    return () => { try { prev?.focus?.(); } catch { /* element gone */ } };
  }, []);
}
