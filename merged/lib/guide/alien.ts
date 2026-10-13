import { ALL_AXES } from '@/lib/alienarchaeology/generate';
import type { AlienSiteState } from '@/lib/alienarchaeology/types';
import type { GuideStep } from './types';

/* ALIEN ARCHAEOLOGY GUIDE — study one specimen, give a reading and a confidence for each question, file. */

export const ALIEN_MODE = 'alien-archaeology';
export const XA_TARGET = {
  study: (id: string) => `xa-study:${id}`,
  reading: (axis: string) => `xa-reading:${axis}`,
  confidence: (axis: string) => `xa-confidence:${axis}`,
  report: 'xa-report',
} as const;

export interface AlienGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export function alienGuide(site: AlienSiteState | null, hasFiledReports: boolean): AlienGuide {
  const eligible = !hasFiledReports;
  if (!site) return { step: null, finished: false, eligible };
  if (site.ending !== 'ongoing') return { step: null, finished: true, eligible };
  const mk = (id: string, text: string, targets: string[], detail: string): AlienGuide => ({ eligible, finished: false, step: { id, text, targets, detail } });

  const unstudied = site.specimens.find(s => !s.revealed);
  if (unstudied && !site.specimens.some(s => s.revealed)) {
    return mk('study', 'STUDY A SPECIMEN', [XA_TARGET.study(unstudied.id)], 'Specimens are your evidence. Study as many as you like before you write your report.');
  }
  const noReading = ALL_AXES.find(a => site.hypotheses[a] == null);
  if (noReading) {
    return mk(`reading:${noReading}`, 'CHOOSE YOUR READING', [XA_TARGET.reading(noReading)], 'There is no single right answer to be punished for. Pick what the specimens suggest to you; you will also say how sure you are.');
  }
  const noConfidence = ALL_AXES.find(a => site.confidences[a] == null);
  if (noConfidence) {
    return mk(`confidence:${noConfidence}`, 'SET HOW SURE YOU ARE', [XA_TARGET.confidence(noConfidence)], 'You are scored on calibration: sounding sure only when you are right, and unsure when you are not. Move the slider.');
  }
  return mk('report', 'FILE YOUR FIELD REPORT', [XA_TARGET.report], 'Your readings and confidences are all set.');
}
