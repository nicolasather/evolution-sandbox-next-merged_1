import type { CSSProperties, ReactNode } from 'react';
import { THEMES, themeInfo, type QuizSettings, type ThemeId } from '@/lib/quiz/settings';

/** Applies a quiz theme to everything inside it. Colours come from CSS variables, so any play screen can sit in a scope. */
export default function ThemeScope({ theme, children, className = '' }: { theme?: Partial<QuizSettings['theme']> | null; children: ReactNode; className?: string }) {
  const id: ThemeId = theme?.id && (THEMES as readonly string[]).includes(theme.id) ? theme.id : 'volt';
  return (
    <div className={`qz-themed ${className}`.trim()} data-theme={id} data-reduced-motion={theme?.reducedMotion ? 'true' : undefined} style={themeInfo[id].vars as CSSProperties}>
      {children}
    </div>
  );
}
