/**
 * ThemeToggle — System/Light/Dark mode selector with localStorage persistence
 */

import React, { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [mounted, setMounted] = useState(false);

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('evo.theme.v1') as ThemeMode | null;
    if (saved && ['system', 'light', 'dark'].includes(saved)) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme('system');
    }
    setMounted(true);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const html = document.documentElement;

    if (mode === 'system') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', mode);
    }

    // Save preference
    localStorage.setItem('evo.theme.v1', mode);
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  if (!mounted) return null;

  return (
    <div className={`${styles.themeToggle} ${className || ''}`}>
      <button
        className={`${styles.button} ${theme === 'light' ? styles.active : ''}`}
        onClick={() => handleThemeChange('light')}
        title="Light mode"
        aria-label="Switch to light mode"
      >
        ☀️ Light
      </button>

      <button
        className={`${styles.button} ${theme === 'system' ? styles.active : ''}`}
        onClick={() => handleThemeChange('system')}
        title="Follow system preference"
        aria-label="Follow system theme preference"
      >
        ⚙️ System
      </button>

      <button
        className={`${styles.button} ${theme === 'dark' ? styles.active : ''}`}
        onClick={() => handleThemeChange('dark')}
        title="Dark mode"
        aria-label="Switch to dark mode"
      >
        🌙 Dark
      </button>
    </div>
  );
}
