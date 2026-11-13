import type { Lang } from './i18n';

/* ============================================================================
   MINIMUM PATH — data text in English. The atlas data ships its chapter titles,
   lessons, mission briefings and source note in Vietnamese. English is the default
   language, so in English those strings come from this table. Vietnamese stays as
   the data has it. Keys are the exact Vietnamese source strings.
   ========================================================================== */

const EN: Record<string, string> = {
  'Ảnh chụp liên kết công thức trong game; chưa kiểm chứng lịch sử. Một cạnh không đại diện một công thức chế tạo đầy đủ. Không bao gồm processing overlay.':
    'A snapshot of the game\'s recipe links, not historically verified. One edge does not stand for a complete crafting recipe. The processing overlay is not included.',

  '01 · Một liên kết': '01 · One link',
  '02 · Đi và trở lại': '02 · There and back',
  '03 · Những ngả rẽ': '03 · Many turns',
  '04 · Điểm bắt buộc': '04 · Must-pass points',
  '05 · Đường bị chặn': '05 · Blocked roads',
  '06 · Giữ hướng': '06 · Keep direction',
  '07 · Hai điểm hẹn': '07 · Two meeting points',
  '08 · Đổi giả thuyết': '08 · Change the hypothesis',
  '09 · Mạng lưới': '09 · The network',
  '10 · Giới hạn': '10 · Limits',
  '11 · Đường tương đương': '11 · Equal routes',
  '12 · Tổng hợp': '12 · Putting it together',

  'Đọc công thức đầy đủ trước khi chọn bước.': 'Read the full recipe before choosing a step.',
  'Liên kết hai chiều cho phép truy ngược nguyên liệu.': 'Two-way links let you trace back to the ingredients.',
  'Nhiều láng giềng không có nghĩa là mọi đường đều ngắn.': 'Many neighbours do not mean every route is short.',
  'Đến đích sau khi đã đi qua tất cả điểm bắt buộc.': 'Reach the target only after passing every must-pass point.',
  'Tìm đường vòng khi một phát minh không được đi qua.': 'Find a detour when a discovery is forbidden.',
  'Chỉ đi từ nguyên liệu tới kết quả công thức.': 'Only travel from the ingredients towards the result.',
  'Nhớ các điểm đã qua, không chỉ vị trí hiện tại.': 'Remember the points you passed, not just where you are.',
  'Thử một nhánh khác khi đường còn lại dài hơn dự kiến.': 'Try another branch when the rest of the route is longer than expected.',
  'Điểm có nhiều liên kết có thể nối các nhóm phát minh.': 'A well-linked point can join groups of discoveries.',
  'Kết hợp điểm bắt buộc và đường bị chặn.': 'Combine must-pass points and blocked roads.',
  'Có thể có nhiều lời giải ngắn nhất cùng số bước.': 'There can be several shortest solutions with the same number of steps.',
  'So sánh đường của bạn với lời giải tối ưu được tính lại.': 'Compare your route with the recomputed optimal solution.',
};

/** The data text in the reader's language. Unknown strings pass through unchanged. */
export function localize(lang: Lang, text: string): string {
  return lang === 'en' ? (EN[text] ?? text) : text;
}
