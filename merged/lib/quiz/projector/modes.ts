/** The registry of the five projector games: what the gallery, setup wizard and host console show. Pure data, EN + VI. */
import type { GameKey, L10n } from './types';

export type ModeInfo = {
  key: GameKey; name: L10n; tagline: L10n; objective: L10n; style: L10n; cooperative: boolean;
  /** palette tokens used by the CSS scene (never random gradients) */
  accent: string; paper: string; ink: string;
  defaultMinutes: number; minTeams: number; maxTeams: number;
  /** what this game rewards the class for knowing */
  skillRule: L10n; art: string;
};
export const MODES: Record<GameKey, ModeInfo> = {
  empire_race: {
    key: 'empire_race', cooperative: false, accent: '#ffd23f', paper: '#f4e3b8', ink: '#2a1b0a', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'empire',
    name: { en: 'Empire Race', vi: 'Đua Đế Chế' },
    tagline: { en: 'Claim the hex map, bridge the rivers, hold your capital.', vi: 'Chiếm bản đồ lục giác, bắc cầu qua sông, giữ vững thủ đô.' },
    objective: { en: 'Own the most land when the sun sets.', vi: 'Giữ nhiều đất nhất khi mặt trời lặn.' },
    style: { en: 'Competitive · territory strategy', vi: 'Đối kháng · chiến lược lãnh thổ' },
    skillRule: { en: 'Every verified answer is planning energy; the team decides where to spend it.', vi: 'Mỗi câu trả lời đã xác minh là năng lượng; đội tự quyết định dùng ở đâu.' },
  },
  boss_battle: {
    key: 'boss_battle', cooperative: true, accent: '#ff5d4a', paper: '#2b1d2e', ink: '#fff4d6', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'boss',
    name: { en: 'Boss Battle', vi: 'Đại Chiến Trùm' },
    tagline: { en: 'The whole class against a clockwork giant. Strike, shield, repair.', vi: 'Cả lớp đấu một người máy khổng lồ. Tấn công, chắn, sửa chữa.' },
    objective: { en: 'Break the boss before it breaks the class.', vi: 'Hạ trùm trước khi trùm hạ cả lớp.' },
    style: { en: 'Cooperative · raid', vi: 'Hợp tác · đánh trùm' },
    skillRule: { en: 'Weak-point topics deal bonus damage, so the class learns what the boss is weak to.', vi: 'Chủ đề điểm yếu gây thêm sát thương, nên cả lớp học đúng chỗ trùm yếu.' },
  },
  escape_room: {
    key: 'escape_room', cooperative: true, accent: '#3ec8e8', paper: '#14313d', ink: '#e9fbff', defaultMinutes: 45, minTeams: 2, maxTeams: 8, art: 'escape',
    name: { en: 'Escape Room', vi: 'Phòng Thoát Hiểm' },
    tagline: { en: 'Inspect, combine, unlock. Every answer opens a clue, a lock or a door.', vi: 'Quan sát, kết hợp, mở khoá. Mỗi câu trả lời mở ra manh mối, ổ khoá hoặc cánh cửa.' },
    objective: { en: 'Get everyone through the last door.', vi: 'Đưa cả lớp qua cánh cửa cuối cùng.' },
    style: { en: 'Cooperative · point-and-click puzzle', vi: 'Hợp tác · giải đố điểm-và-bấm' },
    skillRule: { en: 'Rewards are information and access, never points.', vi: 'Phần thưởng là thông tin và lối đi, không phải điểm số.' },
  },
  treasure_vault: {
    key: 'treasure_vault', cooperative: false, accent: '#7bd88f', paper: '#1f3a2e', ink: '#f2ffe9', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'vault',
    name: { en: 'Treasure Vault', vi: 'Kho Báu' },
    tagline: { en: 'Earn shaped keys for each skill and crack the right door.', vi: 'Kiếm chìa khoá theo hình cho từng kỹ năng và mở đúng cánh cửa.' },
    objective: { en: 'Bank the biggest haul before the vault closes.', vi: 'Gửi vào kho nhiều châu báu nhất trước khi kho đóng.' },
    style: { en: 'Competitive · lock and key', vi: 'Đối kháng · khoá và chìa' },
    skillRule: { en: 'One key shape per skill, so mastery of different topics matters.', vi: 'Mỗi kỹ năng một hình chìa, nên nắm nhiều chủ đề đều có giá trị.' },
  },
  risk_ladder: {
    key: 'risk_ladder', cooperative: false, accent: '#b78bff', paper: '#241a3a', ink: '#f6efff', defaultMinutes: 20, minTeams: 2, maxTeams: 8, art: 'ladder',
    name: { en: 'Risk Ladder', vi: 'Thang Mạo Hiểm' },
    tagline: { en: 'Climb, bank or review. You see what a fall costs before you choose.', vi: 'Leo, gửi hoặc ôn lại. Bạn biết cái giá của việc ngã trước khi chọn.' },
    objective: { en: 'Reach the summit with points safely banked.', vi: 'Lên đỉnh với điểm đã được gửi an toàn.' },
    style: { en: 'Competitive · push-your-luck', vi: 'Đối kháng · cân nhắc rủi ro' },
    skillRule: { en: 'Harder questions sit higher; a review question can earn a shield.', vi: 'Câu khó nằm cao hơn; một câu ôn tập có thể mang lại khiên bảo vệ.' },
  },
};
export const MODE_LIST: ModeInfo[] = Object.values(MODES);
export const isGameKey = (k: unknown): k is GameKey => typeof k === 'string' && k in MODES;
