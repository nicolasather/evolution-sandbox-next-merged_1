// This file provides TypeScript types for the edtech platform database
// Generated based on the migration schemas and actual table structures

export interface Database {
  public: {
    Tables: {
      user_profile: UserProfileRow;
      user_rank: UserRankRow;
      user_xp: UserXPRow;
      user_activity: UserActivityRow;
      // Reference other tables as needed
      quizzes: {
        Row: QuizRow;
        Relationships: QuizRelationships;
      };
      rooms: {
        Row: RoomRow;
        Relationships: RoomRelationships;
      };
      players: {
        Row: PlayerRow;
        Relationships: PlayerRelationships;
      };
      score_events: {
        Row: ScoreEventRow;
        Relationships: ScoreEventRelationships;
      };
      teams: {
        Row: TeamRow;
        Relationships: TeamRelationships;
      };
    };
  };
}

// User Profile Types
export interface UserProfileRow {
  id: string;
  auth_user_id: string;
  display_name: string;
  avatar_url?: string | null;
  xp: number;
  level: number;
  streak: number;
  last_active_room_id?: string | null;
  last_active_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Relationships
  user_xp?: UserXPRow[];
  user_activity?: UserActivityRow[];
  user_rank?: UserRankRow[];
}

// User Rank Types
export interface UserRankRow {
  id: string;
  user_profile_id: string;
  metric: string;
  value: number;
  window_start?: string | null;
  window_end?: string | null;
  composite_score: number;
  rank_position?: number | null;
  created_at?: string;
  updated_at?: string;
  // Relationships
  user_profile?: UserProfileRow;
}

// User XP Types
export interface UserXPRow {
  id: string;
  user_profile_id: string;
  source: string;
  amount: number;
  room_id?: string | null;
  question_id?: string | null;
  metadata?: any; // JSON field
  recorded_at?: string;
  // Relationships
  user_profile?: UserProfileRow;
  room?: RoomRow;
}

// User Activity Types
export interface UserActivityRow {
  id: string;
  user_profile_id: string;
  activity_type: string;
  room_id?: string | null;
  session_duration?: number | null;
  performance_score?: number | null;
  metadata?: any; // JSON field
  recorded_at?: string;
  // Relationships
  user_profile?: UserProfileRow;
  room?: RoomRow;
}

// Reference other table types as needed
export interface QuizRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status: string;
  meta?: any; // JSON field
  archived_at?: string | null;
  review_state?: string;
  source_quiz_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface QuizRelationships {
  quiz_questions?: any[]; // Could be defined more specifically
}

export interface RoomRow {
  id: string;
  quiz_id: string;
  host_id: string;
  join_code: string;
  mode: string;
  flow: string;
  status: string;
  config?: any; // JSON field
  current_index?: number;
  turn_index?: number;
  round_opened_at?: string | null;
  started_at?: string | null;
  expires_at?: string | null;
  paused_at?: string | null;
  revealed?: boolean;
  steal_target_id?: string | null;
  steal_active?: boolean;
  created_at?: string;
}

export interface RoomRelationships {
  room_questions?: any[];
  teams?: TeamRow[];
  players?: PlayerRow[];
  score_events?: ScoreEventRow[];
}

export interface PlayerRow {
  id: string;
  room_id: string;
  display_name: string;
  secret_hash: string;
  points: number;
  cursor_index?: number;
  question_opened_at?: string | null;
  joined_at?: string;
  status?: string;
  identity?: any; // JSON field
  privacy_bucket?: string | null;
}

export interface PlayerRelationships {
  room?: RoomRow;
  submissions?: any[];
  score_events?: ScoreEventRow[];
}

export interface ScoreEventRow {
  id: string;
  room_id: string;
  group_id: string;
  actor_type: string;
  actor_id: string;
  delta: number;
  reason: string;
  meta?: any; // JSON field
  created_at?: string;
  undone_at?: string | null;
}

export interface ScoreEventRelationships {
  room?: RoomRow;
  teams?: TeamRow[];
  players?: PlayerRow[];
}

export interface TeamRow {
  id: string;
  room_id: string;
  display_name: string;
  order_index: number;
  points?: number;
}

export interface TeamRelationships {
  room?: RoomRow;
  score_events?: ScoreEventRow[];
}