/**
 * EdTech Platform — Core Type Definitions
 *
 * Foundational types for the gamified learning platform.
 * Covers users, courses, assignments, game sessions, and analytics.
 */

/* ── Role & Auth ───────────────────────────────────────── */

export type UserRole = 'student' | 'teacher' | 'admin';

export interface EdTechUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  /** XP earned across all activities */
  xp: number;
  /** Current level derived from XP */
  level: number;
  /** Streak — consecutive days of activity */
  streak: number;
  createdAt: string;
  updatedAt: string;
}

/* ── Classroom & Course ────────────────────────────────── */

export interface Classroom {
  id: string;
  name: string;
  code: string; // join code, e.g. "ABCD-1234"
  ownerId: string; // teacher
  description?: string;
  coverImage?: string;
  memberCount: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomMember {
  classroomId: string;
  userId: string;
  role: 'student' | 'teacher' | 'co-teacher';
  joinedAt: string;
  nickname?: string;
}

/* ── Content & Assignments ─────────────────────────────── */

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'fill-blank'
  | 'ordering'
  | 'matching';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  /** Media attachment (image/audio/video URL) */
  mediaUrl?: string;
  options?: QuestionOption[];
  correctAnswer: string | string[];
  explanation?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Points awarded for correct answer */
  points: number;
  /** Time limit in seconds (0 = no limit) */
  timeLimit: number;
  tags: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionSet {
  id: string;
  title: string;
  description?: string;
  authorId: string;
  questions: Question[];
  isPublic: boolean;
  subject?: string;
  gradeLevel?: string;
  tags: string[];
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  classroomId: string;
  questionSetId: string;
  title: string;
  description?: string;
  /** Game mode to use */
  gameMode: GameMode;
  /** When the assignment opens */
  opensAt?: string;
  /** Deadline */
  dueAt?: string;
  /** Max attempts allowed (0 = unlimited) */
  maxAttempts: number;
  /** Whether to show correct answers after submission */
  showAnswers: boolean;
  isActive: boolean;
  createdAt: string;
}

/* ── Game Modes & Sessions ─────────────────────────────── */

export type GameMode =
  | 'classic'        // standard timed quiz
  | 'team-battle'    // teams compete
  | 'survival'       // elimination on wrong answers
  | 'tower-defense'  // answer to build defenses
  | 'race'           // speed-based competition
  | 'flashcard'      // self-paced study mode
  | 'homework'       // async assignment mode
  ;

export type SessionStatus = 'lobby' | 'active' | 'paused' | 'finished';

export interface GameSession {
  id: string;
  hostId: string;
  questionSetId: string;
  gameMode: GameMode;
  /** Room code for joining, e.g. "XYZW" */
  roomCode: string;
  status: SessionStatus;
  /** Current question index */
  currentQuestion: number;
  /** Connected player count */
  playerCount: number;
  /** Session settings */
  settings: GameSettings;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface GameSettings {
  /** Shuffle question order */
  shuffleQuestions: boolean;
  /** Shuffle answer options */
  shuffleOptions: boolean;
  /** Show leaderboard between questions */
  showLeaderboard: boolean;
  /** Enable power-ups */
  powerUps: boolean;
  /** Music theme */
  musicTheme: string;
  /** Points multiplier */
  pointsMultiplier: number;
  /** Time bonus for fast answers */
  timeBonus: boolean;
}

export interface PlayerState {
  userId: string;
  sessionId: string;
  displayName: string;
  avatarUrl?: string;
  /** Score in current session */
  score: number;
  /** Correct answers */
  correct: number;
  /** Total answered */
  answered: number;
  /** Current streak within session */
  streak: number;
  /** Active power-ups */
  activePowerUps: PowerUp[];
  /** Team assignment (for team modes) */
  team?: string;
}

/* ── Gamification ──────────────────────────────────────── */

export type PowerUpKind =
  | 'double-points'
  | 'time-freeze'
  | 'fifty-fifty'
  | 'shield'         // block one wrong answer
  | 'streak-saver'
  ;

export interface PowerUp {
  kind: PowerUpKind;
  /** Remaining uses */
  uses: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** XP reward */
  xpReward: number;
  /** Condition to unlock */
  condition: AchievementCondition;
}

export type AchievementCondition =
  | { type: 'streak'; days: number }
  | { type: 'games-played'; count: number }
  | { type: 'score-total'; points: number }
  | { type: 'perfect-games'; count: number }
  | { type: 'questions-correct'; count: number }
  ;

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  /** Metric label (XP, points, streak, etc.) */
  metric: string;
}

/* ── Analytics & Reports ───────────────────────────────── */

export interface StudentProgress {
  userId: string;
  classroomId: string;
  /** Total games played */
  gamesPlayed: number;
  /** Average accuracy (0–1) */
  accuracy: number;
  /** Total XP earned in this classroom */
  xpEarned: number;
  /** Time spent in seconds */
  timeSpent: number;
  /** Mastery per tag/topic (0–1) */
  masteryByTopic: Record<string, number>;
  /** Recent activity timestamps */
  recentActivity: string[];
}

export interface ClassroomAnalytics {
  classroomId: string;
  /** Total sessions run */
  totalSessions: number;
  /** Average class accuracy */
  avgAccuracy: number;
  /** Most missed questions */
  hardestQuestions: Array<{ questionId: string; missRate: number }>;
  /** Student engagement (active / total) */
  engagementRate: number;
  /** Distribution of scores */
  scoreDistribution: number[];
}
