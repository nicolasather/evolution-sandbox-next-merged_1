import type { SiteFunction, SitePhase, SurveyHint } from './types';

/* ============================================================================
   Turns raw ids into the words the UI and the generated report actually
   print — same "words, not stat labels" discipline as lib/survival/read.ts.
   ========================================================================== */

export const FUNCTION_LABEL: Record<SiteFunction, string> = {
  'seasonal-camp': 'a seasonal camp',
  'permanent-settlement': 'a permanent settlement',
  workshop: 'a specialised workshop',
  'ceremonial-site': 'a ceremonial site',
};

export const PHASE_LABEL: Record<SitePhase, string> = {
  'early-occupation': 'the earliest occupation',
  'peak-occupation': 'the peak occupation',
  'late-occupation': 'the latest occupation',
};

export const SURVEY_HINT_LABEL: Record<SurveyHint, string> = {
  unsurveyed: 'Not yet surveyed',
  none: 'No surface indication',
  faint: 'Faint surface indication',
  strong: 'Strong surface indication',
};
