'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDevOverrides } from '@/lib/dev/overrides';
import { ALWAYS_PLAY, createIntroVisit, type IntroVisit } from '@/lib/cinematic/visit';

/** Owns the visit-scoped "which openings have played" record above the mode switch. */
const Ctx = createContext<IntroVisit>(ALWAYS_PLAY);

export function IntroVisitProvider({ children, visit }: { children: ReactNode; visit?: IntroVisit }) {
  // lazy state: created once per mounted app root, never re-created on re-render
  const [base] = useState<IntroVisit>(() => visit ?? createIntroVisit());
  // Developer Beta only ("skip intros"): every opening counts as already seen. `skipIntros` is false everywhere else.
  const skipIntros = useDevOverrides().skipIntros;
  const value = useMemo<IntroVisit>(() => (skipIntros ? { ...base, hasSeen: () => true } : base), [base, skipIntros]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIntroVisit(): IntroVisit {
  return useContext(Ctx);
}
