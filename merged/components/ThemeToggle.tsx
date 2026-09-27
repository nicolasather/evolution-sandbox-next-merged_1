'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { applyTheme, readPref, savePref, THEME_EVENT, THEMES, type Theme, type ThemePref } from '@/lib/theme';

/** 'system' first, then light/dark, then the accent skins in the order they were added. */
const ORDER: ThemePref[] = ['system', ...THEMES];

const LABEL: Record<ThemePref, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  neon: 'Neon blue',
  ember: 'Ember',
  verdant: 'Verdant',
  glacier: 'Glacier',
  bronze: 'Bronze',
  dusk: 'Dusk',
};

/** Each accent skin's own --ochre, hard-coded here purely so the menu can show every
 *  theme's colour at once — the app itself always reads the live CSS variable, never this. */
const SWATCH: Record<Theme, string> = {
  light: '#a9501c',
  dark: '#c4642c',
  neon: '#00d4ff',
  ember: '#ff6a2e',
  verdant: '#57c785',
  glacier: '#6fc7e8',
  bronze: '#c98a3f',
  dusk: '#9b7cf0',
};

/** True accent skins (not light/dark) get the same "circle + centred glyph" mark neon
 *  originally used, so the family reads as one set of six lit stones. */
const ACCENT: Record<'neon' | 'ember' | 'verdant' | 'glacier' | 'bronze' | 'dusk', ReactNode> = {
  neon: <path d="M9 1.5L3.5 9h4l-1 5.5L12.5 7h-4z" />,
  ember: <path d="M8 2c-1.7 2.6-2.7 4.6-2.7 6.6a2.7 2.7 0 0 0 5.4 0c0-.9-.3-1.6-.8-2.1.1.8-.3 1.3-.9 1.3-.6 0-.9-.5-.7-1.2.4-1.6.2-3.2-.3-4.6Z" />,
  verdant: (
    <>
      <path d="M12.3 3.7c0 5.3-3.1 8.7-8 8.7.6-5.5 3.3-8 8-8.7Z" />
      <path d="M4.9 11.4c1.7-3.1 3.6-5.2 6.4-6.9" fill="none" strokeWidth="1" />
    </>
  ),
  glacier: (
    <g strokeWidth="1.3" strokeLinecap="round">
      <path d="M8 2.5v11" />
      <path d="M3.3 5.25l9.4 5.5" />
      <path d="M12.7 5.25l-9.4 5.5" />
    </g>
  ),
  bronze: (
    <>
      <path d="M8 1.6l5.6 3.2v6.4L8 14.4l-5.6-3.2V4.8L8 1.6Z" fill="none" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  dusk: <path d="M8 1.5c.4 2.6 1.9 4.1 4.5 4.5-2.6.4-4.1 1.9-4.5 4.5-.4-2.6-1.9-4.1-4.5-4.5 2.6-.4 4.1-1.9 4.5-4.5Z" />,
};

function ThemeGlyph({ pref }: { pref: ThemePref }) {
  if (pref === 'system') {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="9" />
        <path d="M5.5 14h5M8 11.5V14" />
        <path d="M8 4.5a2.5 2.5 0 0 0 0 5z" fill="currentColor" />
      </svg>
    );
  }
  if (pref === 'light') {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
      </svg>
    );
  }
  if (pref === 'dark') {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <circle cx="8" cy="8" r="7" opacity=".35" fill="none" />
      {ACCENT[pref]}
    </svg>
  );
}

/** Little two-tone dot shown next to each row in the menu — 'system' gets a
 *  light/dark split rather than one fixed colour, since it has no colour of its own. */
function ThemeDot({ pref }: { pref: ThemePref }) {
  const style =
    pref === 'system'
      ? { background: 'linear-gradient(135deg, #0a0a0b 50%, #f2eee6 50%)' }
      : { background: SWATCH[pref as Theme] };
  return <span className="theme-dot" style={style} aria-hidden="true" />;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
};
const snapshot = (): ThemePref => (document.documentElement.dataset.themePref as ThemePref) || 'system';
const serverSnapshot = (): ThemePref => 'system';

/** One button that opens a menu of every theme — System, Light, Dark, and six
 *  accent skins (Neon blue, Ember, Verdant, Glacier, Bronze, Dusk). The choice
 *  is remembered. This used to be a single button that cycled the (then four)
 *  themes one click at a time; with eight on offer now, a menu you can scan
 *  and pick from reads faster than repeated clicking. */
export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // follow the OS while the preference is "system"
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const onChange = () => { if (readPref() === 'system') applyTheme('system'); };
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        className={className}
        id="theme-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${LABEL[pref]}. Choose a theme.`}
        title={`Theme: ${LABEL[pref]}`}
        onClick={() => setOpen(o => !o)}
      >
        <ThemeGlyph pref={pref} />
      </button>
      {open && (
        <div className="theme-menu" role="listbox" aria-label="Choose a theme">
          {ORDER.map(p => (
            <button
              key={p}
              role="option"
              aria-selected={p === pref}
              className={'item theme-item' + (p === pref ? ' picked' : '')}
              onClick={() => { savePref(p); setOpen(false); }}
            >
              <ThemeDot pref={p} />
              <span className="nm">{LABEL[p]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
