import type { GuideStep } from './types';

/* MINIMUM PATH GUIDE (Vietnamese UI, so the micro-instructions are Vietnamese too). */

export const MINPATH_MODE = 'minimum-path';
export const MP_TARGET = { open: 'mp-open', begin: 'mp-begin', neighbors: 'mp-neighbors' } as const;

export interface MinPathGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export function minimumPathGuide(s: { opened: boolean; hasRun: boolean; done: boolean; steps: number; otherCompletions: number }): MinPathGuide {
  const eligible = s.otherCompletions === 0;
  if (!s.opened) return { eligible, finished: false, step: { id: 'open', text: 'BẤM BẮT ĐẦU', targets: [MP_TARGET.open] } };
  if (!s.hasRun) {
    return { eligible, finished: false, step: { id: 'begin', text: 'BẤM BẮT ĐẦU MÀN ĐÃ CHỌN', targets: [MP_TARGET.begin], detail: 'Màn đầu tiên đã được chọn sẵn. Bạn có thể đổi chương hoặc màn trước khi bấm.' } };
  }
  if (s.done) return { step: null, finished: true, eligible };
  return {
    eligible, finished: false,
    step: { id: 'walk', text: s.steps === 0 ? 'CHỌN PHÁT MINH LIỀN KỀ' : 'ĐI TIẾP TỚI ĐÍCH', targets: [MP_TARGET.neighbors], detail: 'Mỗi lần chọn một phát minh liền kề, mỗi bước tính một cạnh. Hãy tìm đường ít bước nhất. Thử sai không bị phạt; nút "Gợi ý" và "Quay lại" luôn có, chỉ đánh dấu lượt có hỗ trợ.' },
  };
}
