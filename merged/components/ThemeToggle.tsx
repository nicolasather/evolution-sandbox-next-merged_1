'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { applyTheme, readPref, savePref, THEME_EVENT, type ThemePref } from '@/lib/theme';

const ORDER: ThemePref[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemePref, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** One button that cycles System → Light → Dark. The choice is remembered. */
const subscribe = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
};
const snapshot = (): ThemePref => (document.documentElement.dataset.themePref as ThemePref) || 'system';
const serverSnapshot = (): ThemePref => 'system';

export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  useEffect(() => {
    // follow the OS while the preference is "system"
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const onChange = () => { if (readPref() === 'system') applyTheme('system'); };
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];

  return (
    <button
      className={className}
      id="theme-toggle"
      aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[pref]}`}
      onClick={() => savePref(next)}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        {pref === 'system' && (<><rect x="1.5" y="2.5" width="13" height="9" /><path d="M5.5 14h5M8 11.5V14" /><path d="M8 4.5a2.5 2.5 0 0 0 0 5z" fill="currentColor" /></>)}
        {pref === 'light' && (<><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></>)}
        {pref === 'dark' && <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" />}
      </svg>
    </button>
  );
}
