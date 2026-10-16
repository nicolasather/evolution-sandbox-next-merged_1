'use client';
import { useSyncExternalStore } from 'react';
import { retention, type RetentionSave } from '@/lib/retention/store';
import { hubUi } from '@/lib/retention/ui';
import { notices } from '@/lib/retention/notices';

export function useRetention(): Readonly<RetentionSave> {
  useSyncExternalStore(retention.subscribe, retention.getVersion, () => 0);
  return retention.get();
}
export function useHubUi() {
  return useSyncExternalStore(hubUi.subscribe, hubUi.get, hubUi.get);
}
export function useNotices() {
  return useSyncExternalStore(notices.subscribe, notices.get, notices.get);
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}
