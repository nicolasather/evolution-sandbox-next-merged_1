export type QuestionKind = 'multiple_choice' | 'answer_forge' | 'connection_rush' | 'truth_hunt' | 'fill_table';
export type PlayMode = 'solo' | 'classroom' | 'online';
export type Flow = 'synchronized' | 'round_robin' | 'independent';
export type Modifier =
  | 'limited_slots' | 'secret_wager' | 'steal_question' | 'lose_all' | 'go_to_first'
  | 'steal_points' | 'give_points' | 'swap_points' | 'potluck';

export const QUESTION_KINDS: readonly QuestionKind[] = ['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table'];
export const MODIFIERS: readonly Modifier[] = [
  'limited_slots', 'secret_wager', 'steal_question', 'lose_all', 'go_to_first',
  'steal_points', 'give_points', 'swap_points', 'potluck',
];

export const kindLabels: Record<QuestionKind, string> = {
  multiple_choice: 'Multiple Choice',
  answer_forge: 'Answer Forge',
  connection_rush: 'Connection Rush',
  truth_hunt: 'Truth Hunt',
  fill_table: 'Fill the Table',
};

/** A full question as stored: payload is what players see, answerKey never leaves the server before reveal. */
export type Question = {
  id?: string;
  kind: QuestionKind;
  prompt: string;
  payload: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  basePoints: number;
};
export type PublicQuestion = Omit<Question, 'answerKey'> & { position: number };

export type GameConfig = {
  durationSeconds: number;
  questionSeconds: number | null;
  modifiers: Modifier[];
  slotLimit: number;
  teamNames: string[];
  lowPressure?: boolean; quietClassroom?: boolean; untimed?: boolean; readAloud?: boolean; shuffleQuestions?: boolean;
  fairPlay?: boolean; showIdentity?: boolean; cosmeticsEnabled?: boolean; rotateSpeaker?: boolean; cancelled?: boolean;
  hideSpeedBonus?: boolean; replayOf?: string;
  access?: { requireApproval?: boolean; lockedAfterStart?: boolean; hideIdentity?: boolean };
};

export type Room = {
  id: string; quiz_id: string; host_id: string | null; join_code: string;
  mode: PlayMode; flow: Flow; status: 'waiting' | 'active' | 'ended'; config: GameConfig;
  current_index: number; turn_index: number; round_opened_at: string | null; started_at: string | null;
  expires_at: string | null; paused_at: string | null; revealed: boolean;
  steal_target_id: string | null; steal_active: boolean;
};

export const modifierLabels: Record<Modifier, string> = {
  limited_slots: 'Limited Slots',
  secret_wager: 'Secret Wager',
  steal_question: 'Steal the Question',
  lose_all: 'Lose All Points',
  go_to_first: 'Go to First',
  steal_points: 'Steal Points',
  give_points: 'Give Points',
  swap_points: 'Swap Points',
  potluck: 'Potluck',
};

export const modifierDescriptions: Record<Modifier, string> = {
  limited_slots: 'Only the first N answer submissions are accepted for each shared question.',
  secret_wager: 'Commit a wager before answering: a correct answer wins the wager, a wrong one loses it (never more than you hold).',
  steal_question: 'After a wrong answer, the host hands the same question to another team for one try.',
  lose_all: 'The host makes a chosen team or player lose every point they currently hold.',
  go_to_first: 'The host lifts a chosen team or player to the current leader’s score.',
  steal_points: 'The host moves up to N points from one team or player to another.',
  give_points: 'The host makes a team or player hand up to N points to another.',
  swap_points: 'The host makes two teams or players exchange their point totals.',
  potluck: 'A server-side random score event between −200 and +200 points, never dropping below zero. Once per question.',
};

export const flowLabels: Record<Flow, string> = {
  synchronized: 'Synchronized — everyone gets the same question',
  round_robin: 'Round robin — teams answer in turns',
  independent: 'Independent — each player moves at their own pace',
};
export const modeLabels: Record<PlayMode, string> = {
  solo: 'Play solo',
  classroom: 'Classroom projector',
  online: 'Online multiplayer',
};
