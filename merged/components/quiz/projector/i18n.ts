/** EN + VI strings for every projector screen. One flat table; `fmt` fills {placeholders}. Vietnamese diacritics are real text, never images. */
import type { Locale } from '@/lib/quiz/projector/types';

type Row = { en: string; vi: string };
export const STR = {
  start: { en: 'Start game', vi: 'Bắt đầu' }, pause: { en: 'Pause', vi: 'Tạm dừng' }, resume: { en: 'Resume', vi: 'Tiếp tục' },
  extend: { en: 'Add {n} min', vi: 'Thêm {n} phút' }, finishTurn: { en: 'Finish after this turn', vi: 'Kết thúc sau lượt này' }, endNow: { en: 'End now', vi: 'Kết thúc ngay' },
  endConfirm: { en: 'End the game for everyone now? The result is kept.', vi: 'Kết thúc trò chơi ngay cho tất cả? Kết quả được giữ lại.' },
  openProjector: { en: 'Open projector window', vi: 'Mở cửa sổ máy chiếu' }, teacherView: { en: 'Teacher view', vi: 'Chế độ giáo viên' },
  time: { en: 'Time', vi: 'Thời gian' }, untimed: { en: 'No clock', vi: 'Không giới hạn' }, paused: { en: 'Paused', vi: 'Đang tạm dừng' }, lastTurn: { en: 'Last turn', vi: 'Lượt cuối' }, overtime: { en: 'Time is up: finishing this turn', vi: 'Hết giờ: kết thúc lượt này' },
  round: { en: 'Turn {n} of {m}', vi: 'Lượt {n}/{m}' }, yourTurn: { en: '{team}’s turn', vi: 'Lượt của {team}' }, allTeams: { en: 'All teams answer', vi: 'Tất cả các đội trả lời' },
  askQuestion: { en: 'Ask the question', vi: 'Đưa ra câu hỏi' }, correct: { en: 'Correct', vi: 'Đúng' }, wrong: { en: 'Not correct', vi: 'Chưa đúng' },
  markFor: { en: 'Mark {team}’s spoken answer', vi: 'Chấm câu trả lời nói của {team}' }, answerKey: { en: 'Answer (teacher only)', vi: 'Đáp án (chỉ giáo viên)' },
  continueBtn: { en: 'Continue', vi: 'Tiếp tục' }, endTurn: { en: 'End turn', vi: 'Kết thúc lượt' }, undo: { en: 'Undo choice', vi: 'Hủy lựa chọn' },
  teams: { en: 'Teams', vi: 'Các đội' }, energy: { en: 'Energy', vi: 'Năng lượng' }, score: { en: 'Score', vi: 'Điểm' },
  finished: { en: 'Game over', vi: 'Kết thúc trò chơi' }, victory: { en: 'Victory!', vi: 'Chiến thắng!' }, defeat: { en: 'Not this time', vi: 'Lần này chưa được' }, result: { en: 'Result', vi: 'Kết quả' },
  waiting: { en: 'Ready to start. The teacher presses Start.', vi: 'Sẵn sàng. Giáo viên bấm Bắt đầu.' }, loading: { en: 'Loading the game…', vi: 'Đang tải trò chơi…' }, offline: { en: 'Connection lost: retrying. Nothing is lost.', vi: 'Mất kết nối: đang thử lại. Không mất dữ liệu.' },
  conflict: { en: 'The screen was out of date and has been refreshed. Try again.', vi: 'Màn hình chưa được cập nhật và đã được làm mới. Hãy thử lại.' },
  language: { en: 'Language', vi: 'Ngôn ngữ' }, sound: { en: 'Sound', vi: 'Âm thanh' }, captions: { en: 'Captions', vi: 'Phụ đề' }, largePrint: { en: 'Large print', vi: 'Chữ lớn' }, highContrast: { en: 'High contrast', vi: 'Tương phản cao' }, calm: { en: 'Reduce motion', vi: 'Giảm chuyển động' },
  review: { en: 'Review', vi: 'Ôn tập' }, whyAnswer: { en: 'Why', vi: 'Giải thích' }, repeatLabel: { en: 'Review question (repeated)', vi: 'Câu ôn tập (lặp lại)' }, topicFallback: { en: 'No question left on that topic: using another.', vi: 'Hết câu cho chủ đề này: dùng chủ đề khác.' },
  topic: { en: 'Topic', vi: 'Chủ đề' }, difficulty: { en: 'Level', vi: 'Mức' }, easy: { en: 'Easy', vi: 'Dễ' }, medium: { en: 'Medium', vi: 'Vừa' }, hard: { en: 'Hard', vi: 'Khó' },
  // empire
  claim: { en: 'Claim', vi: 'Chiếm' }, fortify: { en: 'Fortify', vi: 'Gia cố' }, research: { en: 'Scout', vi: 'Do thám' }, bridge: { en: 'Build bridge', vi: 'Bắc cầu' }, challenge: { en: 'Challenge', vi: 'Thách đấu' }, chooseZone: { en: 'Pick a zone for the question', vi: 'Chọn vùng cho câu hỏi' },
  tile: { en: 'Zone {n}', vi: 'Vùng {n}' }, capital: { en: 'Capital', vi: 'Thủ đô' }, owner: { en: 'Held by {team}', vi: 'Thuộc {team}' }, unclaimed: { en: 'Unclaimed', vi: 'Chưa có chủ' },
  // boss
  strike: { en: 'Strike', vi: 'Tấn công' }, defend: { en: 'Shield', vi: 'Chắn' }, repair: { en: 'Repair', vi: 'Sửa chữa' }, scan: { en: 'Scan', vi: 'Quét' }, combine: { en: 'Combine', vi: 'Phối hợp' },
  bossHp: { en: 'Boss', vi: 'Trùm' }, classHp: { en: 'Class', vi: 'Cả lớp' }, shield: { en: 'Shield', vi: 'Khiên' }, phase: { en: 'Phase {n}', vi: 'Giai đoạn {n}' }, weakPoint: { en: 'Weak point: {t}', vi: 'Điểm yếu: {t}' }, telegraph: { en: 'Next: {k}', vi: 'Sắp tới: {k}' },
  aimWeak: { en: 'Aim at weak point', vi: 'Nhắm điểm yếu' }, partner: { en: 'Partner', vi: 'Đồng đội' },
  // escape
  inspect: { en: 'Inspect', vi: 'Quan sát' }, unlock: { en: 'Use items', vi: 'Dùng vật phẩm' }, hint: { en: 'Hint', vi: 'Gợi ý' }, trade: { en: 'Trade item', vi: 'Đổi vật phẩm' }, bypass: { en: 'Skip puzzle (teacher)', vi: 'Bỏ qua câu đố (giáo viên)' },
  room: { en: 'Room {n} of {m}', vi: 'Phòng {n}/{m}' }, inventory: { en: 'Notebook', vi: 'Sổ tay' }, hintTokens: { en: 'Hints left: {n}', vi: 'Gợi ý còn lại: {n}' }, needs: { en: 'Needs: {i}', vi: 'Cần: {i}' }, locked: { en: 'Locked', vi: 'Đã khóa' }, opened: { en: 'Open', vi: 'Đã mở' }, solved: { en: 'Solved', vi: 'Đã giải' },
  escaped: { en: 'Everyone is through the last door.', vi: 'Cả lớp đã qua cánh cửa cuối cùng.' },
  // vault
  openVault: { en: 'Open vault', vi: 'Mở két' }, bank: { en: 'Bank keys', vi: 'Gửi vào kho' }, share: { en: 'Share a key', vi: 'Chia sẻ chìa' }, grand: { en: 'Grand vault', vi: 'Đại kho báu' }, held: { en: 'In hand', vi: 'Đang cầm' }, banked: { en: 'Banked', vi: 'Đã gửi' }, chooseVault: { en: 'Choose a vault', vi: 'Chọn một két' }, requires: { en: 'Needs', vi: 'Cần' },
  // ladder
  climb: { en: 'Climb', vi: 'Leo' }, bankPts: { en: 'Bank points', vi: 'Gửi điểm' }, reviewBtn: { en: 'Review for a shield', vi: 'Ôn tập lấy khiên' }, summit: { en: 'Summit', vi: 'Đỉnh' }, atRisk: { en: 'At risk: {n}', vi: 'Có thể mất: {n}' }, fallsTo: { en: 'A fall lands on step {n}', vi: 'Ngã sẽ xuống bậc {n}' }, gain: { en: 'Gain {n}', vi: 'Được {n}' },
  steady: { en: 'Steady route', vi: 'Đường vững' }, steep: { en: 'Steep route', vi: 'Đường dốc' }, normalRoute: { en: 'Main route', vi: 'Đường chính' },
  // setup
  chooseGame: { en: 'Choose a game', vi: 'Chọn trò chơi' }, chooseTime: { en: 'How long is the lesson?', vi: 'Tiết học dài bao lâu?' }, minutes: { en: '{n} min', vi: '{n} phút' }, launch: { en: 'Create the game', vi: 'Tạo trò chơi' },
  // report
  report: { en: 'Class report', vi: 'Báo cáo lớp' }, byTopic: { en: 'By topic', vi: 'Theo chủ đề' }, answered: { en: '{n} answered', vi: 'Đã trả lời {n}' }, accuracy: { en: '{p}% correct', vi: 'Đúng {p}%' }, needsRevisit: { en: 'Worth revisiting', vi: 'Nên ôn lại' }, gotItRight: { en: 'Strong topics', vi: 'Chủ đề vững' },
} satisfies Record<string, Row>;
export type Key = keyof typeof STR;

export function tr(locale: Locale, key: Key, vars?: Record<string, string | number>): string {
  const s = STR[key][locale] ?? STR[key].en;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s;
}
export const L = (locale: Locale, v: { en: string; vi: string }) => v[locale] ?? v.en;

const ERR: Record<string, Row> = {
  wrongPhase: { en: 'That cannot be done right now.', vi: 'Lúc này chưa thể làm việc đó.' }, noEnergy: { en: 'Not enough energy ({have} of {need}).', vi: 'Không đủ năng lượng ({have}/{need}).' },
  notYourTurn: { en: 'It is not that team’s turn.', vi: 'Chưa đến lượt đội đó.' }, notAdjacent: { en: 'That zone is not next to your land.', vi: 'Vùng đó không giáp đất của đội.' }, tileTaken: { en: 'Someone already holds that zone.', vi: 'Vùng này đã có chủ.' },
  duelOpen: { en: 'Finish the duel first.', vi: 'Hãy kết thúc cuộc thách đấu trước.' }, needItems: { en: 'You need the right items first.', vi: 'Cần đúng vật phẩm trước.' }, missingKeys: { en: 'The right keys are missing.', vi: 'Chưa đủ chìa phù hợp.' },
  cooldown: { en: 'Still recharging ({turns} turns).', vi: 'Đang nạp lại ({turns} lượt).' }, noQuestions: { en: 'No questions are left, so the game ends here.', vi: 'Hết câu hỏi nên trò chơi kết thúc tại đây.' },
  tooFewQuestions: { en: 'This quiz is {n} questions short for that length. Pick a shorter lesson or allow a labelled review cycle.', vi: 'Bộ câu hỏi còn thiếu {n} câu cho thời lượng này. Chọn thời lượng ngắn hơn hoặc cho phép vòng ôn lặp lại có nhãn.' },
  revisionConflict: { en: 'The screen was out of date and has been refreshed. Try again.', vi: 'Màn hình chưa cập nhật và đã được làm mới. Hãy thử lại.' }, notRunning: { en: 'Press Start first.', vi: 'Hãy bấm Bắt đầu trước.' }, paused: { en: 'The game is paused.', vi: 'Trò chơi đang tạm dừng.' },
  needVerdict: { en: 'Mark the answer correct or not correct.', vi: 'Hãy chấm đúng hoặc chưa đúng.' }, finished: { en: 'The game is over.', vi: 'Trò chơi đã kết thúc.' }, reasonRequired: { en: 'Give a short reason first.', vi: 'Hãy nhập lý do ngắn trước.' },
};
/** Turn an API/reducer error ("projector:code:param") into a sentence the class can read. */
export function errText(locale: Locale, message: string): string {
  const m = /^projector:([A-Za-z]+)(?::(.*))?$/.exec(message);
  if (!m) return message;
  const row = ERR[m[1]!]; if (!row) return message;
  let vars: Record<string, string | number> = {};
  const tail = m[2];
  if (tail) { try { vars = JSON.parse(tail) as Record<string, number>; } catch { vars = { n: tail }; } }
  return row[locale].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
export const detectLocale = (): Locale => (typeof navigator !== 'undefined' && /^vi/i.test(navigator.language) ? 'vi' : 'en');

const LOG: Record<string, Row> = {
  asked: { en: '{team} gets a question', vi: '{team} nhận câu hỏi' }, claim: { en: '{team} claimed zone {tile}', vi: '{team} chiếm vùng {tile}' }, fortify: { en: '{team} fortified zone {tile}', vi: '{team} gia cố vùng {tile}' },
  challenge: { en: '{team} challenges zone {tile}', vi: '{team} thách đấu vùng {tile}' }, duelHeld: { en: '{team} held zone {tile}', vi: '{team} giữ vững vùng {tile}' }, research: { en: '{team} scouted zone {tile} (+{pts})', vi: '{team} do thám vùng {tile} (+{pts})' },
  bridge: { en: '{team} built a bridge', vi: '{team} bắc một cây cầu' }, zoneChosen: { en: '{team} picked zone {tile}', vi: '{team} chọn vùng {tile}' }, comeback: { en: 'Comeback boost for {team}', vi: 'Hỗ trợ bứt lên cho {team}' },
  chose: { en: '{team} chose {action}', vi: '{team} chọn {action}' }, role: { en: '{team} is now on {role}', vi: '{team} chuyển sang vai {role}' }, defend: { en: '{team} added {amount} shield', vi: '{team} thêm {amount} khiên' }, repair: { en: '{team} repaired {amount}', vi: '{team} sửa chữa {amount}' },
  bossAttack: { en: 'The boss hits for {dmg} (shield soaked {soaked})', vi: 'Trùm đánh {dmg} (khiên chặn {soaked})' }, bossAttackSoft: { en: 'The boss swings and the shield holds', vi: 'Trùm vung đòn nhưng khiên đỡ được' }, bossPhase: { en: 'The boss enters phase {phase}', vi: 'Trùm vào giai đoạn {phase}' },
  bossWeak: { en: 'The weak point is exposed', vi: 'Điểm yếu đã lộ ra' }, bossBarrier: { en: 'The boss raises a barrier', vi: 'Trùm dựng rào chắn' }, bossSurge: { en: 'The boss surges', vi: 'Trùm bùng lên' }, scan: { en: '{team} scanned the boss', vi: '{team} quét trùm' }, scanned: { en: '{team} scanned the boss', vi: '{team} quét trùm' },
  inspect: { en: '{team} inspects {hs}', vi: '{team} quan sát {hs}' }, hint: { en: '{team} used a hint', vi: '{team} dùng gợi ý' }, trade: { en: '{team} passed {item}', vi: '{team} chuyển {item}' }, roomEntered: { en: '{team} entered room {room}', vi: '{team} vào phòng {room}' }, miss: { en: '{team} did not get it', vi: '{team} chưa đúng' },
  chooseVault: { en: '{team} eyes vault {vault}', vi: '{team} nhắm két {vault}' }, vaultOpened: { en: '{team} opened vault {vault} (+{reward})', vi: '{team} mở két {vault} (+{reward})' }, grandOpened: { en: '{team} opened the grand vault (+{reward})', vi: '{team} mở đại kho báu (+{reward})' }, banked: { en: '{team} banked {pts}', vi: '{team} gửi {pts}' }, scannerBought: { en: '{team} bought a scanner', vi: '{team} mua máy quét' }, shared: { en: '{team} shared a key with {to}', vi: '{team} chia chìa cho {to}' },
  bank: { en: '{team} banked {pts} at step {tier}', vi: '{team} gửi {pts} ở bậc {tier}' }, climb: { en: '{team} climbed to step {tier}', vi: '{team} leo lên bậc {tier}' }, climbBridge: { en: '{team} reached step {tier}', vi: '{team} lên tới bậc {tier}' }, fall: { en: '{team} slipped from {from} to {to}', vi: '{team} trượt từ {from} xuống {to}' }, shieldGained: { en: '{team} earned a shield', vi: '{team} nhận được khiên' }, shieldUsed: { en: '{team}’s shield absorbed a fall', vi: 'Khiên của {team} đỡ cú ngã' }, reviewDone: { en: '{team} finished a review', vi: '{team} hoàn thành phần ôn' }, halfStep: { en: '{team} gained a half step', vi: '{team} tiến nửa bậc' },
  practiceMiss: { en: '{team} practised a miss', vi: '{team} luyện lại câu sai' }, practiceStar: { en: '{team} earned a practice star', vi: '{team} nhận sao luyện tập' },
  revealed: { en: 'Answer revealed', vi: 'Đã hiện đáp án' }, extended: { en: 'Time extended by {minutes} min', vi: 'Gia hạn thêm {minutes} phút' }, finishTurnSet: { en: 'The game ends after this turn', vi: 'Trò chơi sẽ kết thúc sau lượt này' }, timeUpFinishTurn: { en: 'Time is up: ending after this turn', vi: 'Hết giờ: kết thúc sau lượt này' }, turnSkipped: { en: '{team}’s turn was skipped', vi: 'Bỏ qua lượt của {team}' }, undo: { en: 'Choice undone', vi: 'Đã hủy lựa chọn' }, finished: { en: 'The game is over', vi: 'Trò chơi đã kết thúc' },
};
export function logText(locale: Locale, e: { k: string; team?: string; p?: Record<string, string | number> }, teamName: (id?: string) => string): string {
  const row = LOG[e.k]; if (!row) return e.k;
  return row[locale].replace(/\{(\w+)\}/g, (_, k) => (k === 'team' ? teamName(e.team) : String(e.p?.[k] ?? '')));
}
