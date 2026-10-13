import type { ContentIndex, LifelinesState } from '@/lib/civilization/lifelines/schema';
import { blockReasonText, legalDistricts, programmeOption, tutorialStep, visibleProgrammes } from '@/lib/civilization/lifelines/selectors';
import type { GuideStep } from './types';

/* ============================================================================
   CIVILIZATION · LIFELINES GUIDE — derives the one current micro-instruction.

   It REUSES the game's own state-derived `tutorialStep()` (start-programme →
   advance → read-forecast → handle-event → done) and its legal-district and
   programme-availability selectors. It adds exactly one thing: the sub-steps
   inside "start a programme" (choose a district → open Programmes → choose →
   start), derived from what is open on screen right now. Nothing here writes to
   the game, and nothing is recommended that the rules do not allow.
   ========================================================================== */

export interface CivGuideUi {
  selectedDistrictId: string | null;
  panel: 'none' | 'programmes' | 'council' | 'forecast' | 'settings' | 'help';
  /** The programme currently picked in the drawer (with the district it is previewed for), if any. */
  preview: { projectId: string; districtId: string } | null;
  /** The run is read-only (another tab owns it) or the chapter was archived. */
  locked: boolean;
  /** The player has already completed a chapter: no beginner guide unless they switch it on. */
  hasCompletions: boolean;
}

export interface CivGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export const GUIDE_TARGET = {
  district: (id: string) => `district:${id}`,
  programme: (id: string) => `prog:${id}`,
  programmesButton: 'programmes-dock',
  plan: 'plan',
  advance: 'advance',
  forecast: 'forecast',
  event: 'event-choice',
  hint: 'hint',
} as const;

export function civilizationGuide(index: ContentIndex, run: LifelinesState, ui: CivGuideUi): CivGuide {
  const chapter = index.chapters.get(run.chapterId);
  const first = !!chapter && chapter.order === 1;
  const eligible = first && !ui.hasCompletions;
  const none: CivGuide = { step: null, finished: false, eligible };
  if (!first || ui.locked) return none;

  const tut = tutorialStep(index, run);

  // A mandatory event always comes first, whatever else is on screen.
  if (run.pendingEventId) {
    return {
      eligible, finished: false,
      step: { id: 'event', text: 'MAKE A DECISION', targets: [GUIDE_TARGET.event], detail: 'A pressure needs a response. None of the options ends your settlement, and every option is a fair choice.', sr: 'A pressure needs a response. Choose any option; none of them ends your settlement.' },
    };
  }

  if (tut.step === 'done') return { step: null, finished: true, eligible };

  if (tut.step === 'advance') {
    return { eligible, finished: false, step: { id: 'advance', text: 'ADVANCE THE SEASON', targets: [GUIDE_TARGET.advance], detail: tut.text, sr: 'Press Advance season so the planned work can happen.' } };
  }
  if (tut.step === 'read-forecast') {
    return { eligible, finished: false, step: { id: 'forecast', text: 'CHECK THE FORECAST', targets: [GUIDE_TARGET.forecast], detail: tut.text, sr: 'Open the Forecast to see what the next season will do.' } };
  }
  if (tut.step === 'handle-event') {
    return { eligible, finished: false, step: { id: 'event', text: 'MAKE A DECISION', targets: [GUIDE_TARGET.event], detail: tut.text } };
  }

  /* ---- start-programme: the sub-steps ---- */
  const projectId = tut.projectId;
  const project = projectId ? index.projects.get(projectId) : undefined;
  if (!projectId || !project) return none;
  const detail = tut.text;
  const legal = legalDistricts(index, run, projectId);
  const option = programmeOption(index, run, project);

  if (legal.length === 0) {
    return { eligible, finished: false, step: { id: 'no-district', text: 'ASK FOR A HINT', targets: [GUIDE_TARGET.hint], detail: 'No district can host this programme right now. The hint explains what to do next.' } };
  }

  // The player already picked something in the drawer: guide the Plan button, but only if it is really available.
  if (ui.panel === 'programmes' && ui.preview) {
    const picked = index.projects.get(ui.preview.projectId);
    if (picked) {
      const po = programmeOption(index, run, picked);
      const here = po.districts.find(d => d.id === ui.preview?.districtId);
      if (here && here.reason === null) {
        return { eligible, finished: false, step: { id: 'start', text: 'START THE PROGRAMME', targets: [GUIDE_TARGET.plan], detail: 'Planning uses one action and reserves the cost once. The work happens when you advance the season.', sr: 'Press the Plan it button to start the programme.' } };
      }
      return {
        eligible, finished: false,
        step: {
          id: 'blocked:' + picked.id, text: 'TRY ANOTHER OPTION', targets: picked.id === projectId ? [] : [GUIDE_TARGET.programme(projectId)],
          detail: here?.reasonText ?? (here?.reason ? blockReasonText(here.reason) : po.reasonText ?? 'This programme cannot be planned here yet.'),
        },
      };
    }
  }

  const sel = ui.selectedDistrictId;
  const selOk = !!sel && legal.some(d => d.id === sel);
  if (!selOk) {
    return { eligible, finished: false, step: { id: 'district', text: 'CHOOSE A DISTRICT', targets: legal.map(d => GUIDE_TARGET.district(d.id)), detail, sr: 'Choose a highlighted district on the settlement map.' } };
  }

  if (option.reason) {
    // The recommended programme cannot be planned yet: say why instead of glowing something that will not work.
    return { eligible, finished: false, step: { id: 'blocked:' + projectId, text: 'SOMETHING IS MISSING', targets: [GUIDE_TARGET.hint], detail: option.reasonText ?? 'Ask for a hint to see what is needed first.' } };
  }

  if (ui.panel !== 'programmes') {
    return { eligible, finished: false, step: { id: 'open-programmes', text: 'OPEN PROGRAMMES', targets: [GUIDE_TARGET.programmesButton], detail, sr: 'Press the Programmes button to list what you can build here.' } };
  }

  const listed = visibleProgrammes(index, run, false).some(o => o.project.id === projectId);
  return {
    eligible, finished: false,
    step: {
      id: 'choose-programme', text: 'CHOOSE A PROGRAMME', targets: listed ? [GUIDE_TARGET.programme(projectId)] : [], detail,
      sr: `Choose ${project.name} in the Programmes list.`,
    },
  };
}
