'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { ALWAYS_PLAY, createIntroVisit, type IntroVisit } from '@/lib/cinematic/visit';

/** Owns the visit-scoped "which openings have played" record above the mode switch. */
const Ctx = createContext<IntroVisit>(ALWAYS_PLAY);

export function IntroVisitProvider({ children, visit }: { children: ReactNode; visit?: IntroVisit }) {
  // lazy state: created once per mounted app root, never re-created on re-render
  const [value] = useState<IntroVisit>(() => visit ?? createIntroVisit());
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIntroVisit(): IntroVisit {
  return useContext(Ctx);
}
