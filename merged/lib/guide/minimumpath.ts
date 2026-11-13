import type { Lang } from '@/lib/minimumpath/i18n';
import type { GuideStep } from './types';

/* MINIMUM PATH GUIDE — the micro-instructions follow the mode's UI language (one language per screen). */

export const MINPATH_MODE = 'minimum-path';
export const MP_TARGET = { open: 'mp-open', begin: 'mp-begin', neighbors: 'mp-neighbors' } as const;

export interface MinPathGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

const COPY: Record<Lang, {
  press: string; pressSelected: string; selectedDetail: string;
  first: string; next: string; walkDetail: string;
}> = {
  en: {
    press: 'PRESS START',
    pressSelected: 'PRESS START ON THE SELECTED MISSION',
    selectedDetail: 'The first mission is already selected. You can change the chapter or the mission before you press.',
    first: 'PICK AN ADJACENT DISCOVERY',
    next: 'KEEP GOING TO THE TARGET',
    walkDetail: 'Each step picks one adjacent discovery and counts as one edge. Find the route with the fewest steps. Wrong tries are not penalised. "Hint" and "Go back" are always there, but they mark the run as assisted.',
  },
  vi: {
    press: 'BẤM BẮT ĐẦU',
    pressSelected: 'BẤM BẮT ĐẦU MÀN ĐÃ CHỌN',
    selectedDetail: 'Màn đầu tiên đã được chọn sẵn. Bạn có thể đổi chương hoặc màn trước khi bấm.',
    first: 'CHỌN PHÁT MINH LIỀN KỀ',
    next: 'ĐI TIẾP TỚI ĐÍCH',
    walkDetail: 'Mỗi lần chọn một phát minh liền kề, mỗi bước tính một cạnh. Hãy tìm đường ít bước nhất. Thử sai không bị phạt; nút "Gợi ý" và "Quay lại" luôn có, chỉ đánh dấu lượt có hỗ trợ.',
  },
};

export function minimumPathGuide(
  s: { opened: boolean; hasRun: boolean; done: boolean; steps: number; otherCompletions: number },
  lang: Lang = 'en',
): MinPathGuide {
  const c = COPY[lang];
  const eligible = s.otherCompletions === 0;
  if (!s.opened) return { eligible, finished: false, step: { id: 'open', text: c.press, targets: [MP_TARGET.open] } };
  if (!s.hasRun) {
    return { eligible, finished: false, step: { id: 'begin', text: c.pressSelected, targets: [MP_TARGET.begin], detail: c.selectedDetail } };
  }
  if (s.done) return { step: null, finished: true, eligible };
  return {
    eligible, finished: false,
    step: { id: 'walk', text: s.steps === 0 ? c.first : c.next, targets: [MP_TARGET.neighbors], detail: c.walkDetail },
  };
}
