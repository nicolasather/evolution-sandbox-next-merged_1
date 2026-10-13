import { isFindRevealed } from '@/lib/archaeology/simulate';
import type { SiteState } from '@/lib/archaeology/types';
import type { GuideStep } from './types';

/* ARCHAEOLOGIST GUIDE — survey one square, dig, analyze one find, state a hypothesis, file the report.
   Derived from the site's own budgets and finds; never suggests an action the budgets forbid. */

export const ARCH_MODE = 'archaeology';
export const ARCH_TARGET = {
  survey: (x: number, y: number) => `arch-survey:${x},${y}`,
  dig: (x: number, y: number) => `arch-dig:${x},${y}`,
  analyze: (id: string) => `arch-analyze:${id}`,
  fn: 'arch-function',
  report: 'arch-report',
} as const;

export interface ArchGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export function archaeologyGuide(site: SiteState | null, hasFiledReports: boolean): ArchGuide {
  const eligible = !hasFiledReports;
  if (!site) return { step: null, finished: false, eligible };
  if (site.ending !== 'ongoing') return { step: null, finished: true, eligible };

  const squares = site.squares.flat();
  const surveyLeft = site.spent.survey < site.budgets.survey;
  const digLeft = site.spent.excavate < site.budgets.excavate;
  const analyzeLeft = site.spent.analyze < site.budgets.analyze;
  const revealed = site.finds.filter(f => isFindRevealed(site, f));
  const unanalyzed = revealed.filter(f => !f.analyzed);
  const analyzedCount = revealed.length - unanalyzed.length;
  const mk = (id: string, text: string, targets: string[], detail?: string): ArchGuide => ({ eligible, finished: false, step: { id, text, targets, detail } });

  const diggable = (sq: SiteState['squares'][number][number]) => sq.dugContexts < sq.contexts.length;
  const anySurveyed = squares.some(s => s.surveyHint !== 'unsurveyed');

  if (site.spent.survey === 0 && !anySurveyed && surveyLeft && digLeft) {
    const sq = squares.find(s => s.surveyHint === 'unsurveyed');
    if (sq) return mk('survey', 'SURVEY A SQUARE', [ARCH_TARGET.survey(sq.x, sq.y)], 'Surveying is cheap and tells you whether a square looks worth digging. You only have a few digs, so spend them where the survey says something is there.');
  }
  if (revealed.length === 0 && digLeft) {
    const sq = squares.find(s => s.surveyHint !== 'unsurveyed' && diggable(s)) ?? squares.find(diggable);
    if (sq) return mk('dig', 'DIG A SQUARE', [ARCH_TARGET.dig(sq.x, sq.y)], 'Digging uncovers finds. Each square has layers, so one dig may not reveal everything.');
  }
  if (analyzedCount === 0 && unanalyzed.length > 0 && analyzeLeft) {
    return mk('analyze', 'ANALYZE A FIND', [ARCH_TARGET.analyze(unanalyzed[0].id)], 'Analysis turns an unidentified object into evidence you can argue from.');
  }
  if (!site.hypotheses.function) {
    return mk('function', 'CHOOSE WHAT THE SITE WAS', [ARCH_TARGET.fn], 'Pick the interpretation your evidence best supports. All four are possible; the report is judged by the evidence you recovered, not by luck.');
  }
  return mk('report', 'FILE YOUR REPORT', [ARCH_TARGET.report], 'You can file once you have a working hypothesis. A thin report is allowed; it is simply marked as thin.');
}
