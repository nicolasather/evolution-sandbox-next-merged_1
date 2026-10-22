-- 007_user_rank.sql — Creates user_profile and user_rank tables for edtech platform ranking.
-- This migration establishes user identity linking and persistent ranking storage.

-- 1. user_profile: Links auth.users to players, stores profile data, and tracks progress ----------
create table if not exists public.user_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,

  -- Core identification
  display_name text not null,
  avatar_url text,

  -- Gamification progress
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  streak integer not null default 0 check (streak >= 0),

  -- Room/score history links for ranking calculation
  last_active_room_id uuid references public.rooms(id) on delete set null,
  last_active_at timestamptz not null default now(),

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profile_auth_user_id on public.user_profile(auth_user_id);
create index if not exists user_profile_level on public.user_profile(level desc);

-- 2. user_rank: Stores computed composite rankings ----------
create table if not exists public.user_rank (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profile(id) on delete cascade,

  -- Multiple metric dimensions for ranking
  metric text not null,                          -- e.g., 'xp', 'score', 'streak', 'performance'
  value bigint not null check (value >= -1000000000),

  -- Time window for the ranking (null = all-time)
  window_start timestamptz,
  window_end timestamptz,

  -- Computed derived fields
  composite_score decimal(15,6) not null,       -- Weighted score for final ranking
  rank_position integer,                         -- Cache for position

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_rank_profile_id on public.user_rank(user_profile_id);
create index if not exists user_rank_metric on public.user_rank(metric);
create index if not exists user_rank_composite on public.user_rank(composite_score desc);
create unique index if not exists user_rank_unique_profile_metric_window on public.user_rank(user_profile_id, metric, window_start, window_end)
  where window_start is not null and window_end is not null;
create unique index if not exists user_rank_unique_profile_metric_all_time on public.user_rank(user_profile_id, metric)
  where window_start is null and window_end is null;

-- 3. user_xp: Tracks XP gains per source ----------
create table if not exists public.user_xp (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profile(id) on delete cascade,

  -- Source tracking
  source text not null,                          -- e.g., 'quiz_correct', 'assignment_complete', 'bonus'
  amount integer not null check (amount > 0),

  -- Context for debugging and queries
  room_id uuid references public.rooms(id) on delete set null,
  question_id text,
  metadata jsonb not null default '{}'::jsonb,

  -- Timestamp
  recorded_at timestamptz not null default now()
);

create index if not exists user_xp_profile on public.user_xp(user_profile_id);
create index if not exists user_xp_source on public.user_xp(source);

-- 4. user_activity: Tracks user engagement for streak calculation ----------
create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profile(id) on delete cascade,

  -- Activity tracking
  activity_type text not null,                   -- e.g., 'quiz_complete', 'answer_correct', 'content_view'
  room_id uuid references public.rooms(id) on delete set null,
  session_duration integer,                       -- seconds
  performance_score decimal(5,2),               -- 0-100 scale, null = not applicable

  -- Context
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists user_activity_profile on public.user_activity(user_profile_id);
create index if not exists user_activity_recorded_at on public.user_activity(recorded_at desc);

-- 5. RLS and permissions for all new tables ----------
-- Enable RLS on new tables
alter table public.user_profile enable row level security;
alter table public.user_rank enable row level security;
alter table public.user_xp enable row level security;
alter table public.user_activity enable row level security;

-- Deny all access to anon/authenticated users
revoke all on public.user_profile, public.user_rank, public.user_xp, public.user_activity from anon, authenticated;

-- Grant full access to service_role
grant select, insert, update, delete on public.user_profile, public.user_rank, public.user_xp, public.user_activity to service_role;

-- 6. Functions to manage user profiles and rankings ----------

-- Function to create or update user profile from auth user
create or replace function public.ensure_user_profile(p_auth_user_id uuid, p_display_name text, p_avatar_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  -- Check if profile already exists
  if exists (select 1 from public.user_profile where auth_user_id = p_auth_user_id) then
    -- Update existing profile with new display name if provided
    update public.user_profile
    set display_name = coalesce(p_display_name, display_name),
        avatar_url = coalesce(p_avatar_url, avatar_url),
        updated_at = now()
    where auth_user_id = p_auth_user_id;
  else
    -- Create new profile
    insert into public.user_profile (auth_user_id, display_name, avatar_url)
    values (p_auth_user_id, p_display_name, p_avatar_url);
  end if;

  return jsonb_build_object('success', true, 'profile_id', (select id from public.user_profile where auth_user_id = p_auth_user_id));
end;
$$;

-- Function to sync XP and calculate new level
create or replace function public.add_user_xp(p_user_profile_id uuid, p_amount integer, p_source text, p_room_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_new_xp bigint;
  v_new_level integer;
  v_old_level integer;
begin
  -- Get current profile
  update public.user_profile
  set xp = xp + p_amount,
      updated_at = now()
  where id = p_user_profile_id
  returning xp, level into v_new_xp, v_new_level;

  -- Calculate new level (assuming 100 XP per level)
  v_old_level := v_new_level - floor((v_new_xp - p_amount) / 100);

  -- Record the XP gain
  insert into public.user_xp (user_profile_id, source, amount, room_id, metadata)
  values (p_user_profile_id, p_source, p_amount, p_room_id, p_metadata);

  -- Update streak
  update public.user_profile
  set streak = case
    when last_active_at < now() - interval '1 day' then 1
    else streak + 1
  end,
  last_active_room_id = p_room_id,
  last_active_at = now(),
  updated_at = now()
  where id = p_user_profile_id;

  -- Recalculate level based on total XP
  update public.user_profile
  set level = floor(xp / 100) + 1
  where id = p_user_profile_id
  returning level into v_new_level;

  return jsonb_build_object('new_xp', v_new_xp, 'new_level', v_new_level, 'old_level', v_old_level, 'streak', (select streak from public.user_profile where id = p_user_profile_id));
end;
$$;

-- Function to recalculate user rank based on current data
create or replace function public.recalculate_user_rank(p_user_profile_id uuid, p_metric text, p_window_start timestamptz default null, p_window_end timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_value bigint := 0;
  v_composite_score decimal := 0;
  v_rank_position integer;
begin
  -- Calculate metric value based on type
  if p_metric = 'xp' then
    select sum(amount) into v_value from public.user_xp where user_profile_id = p_user_profile_id;
    v_composite_score := v_value;
  elsif p_metric = 'score' then
    -- Sum of score_events for rooms associated with this user (via player relationships)
    with user_rooms as (
      select distinct r.id from public.rooms r
      join public.players p on p.room_id = r.id
      join public.user_profile up on up.auth_user_id = (select id from auth.users where id = p.actor_id)  -- This is a simplification - we need to link auth.users to user_profile
      where up.id = p_user_profile_id
    ),
    user_scores as (
      select coalesce(sum(delta), 0) as total_score from public.score_events
      where room_id in (select id from user_rooms)
    )
    select coalesce(total_score, 0) into v_value;
    v_composite_score := v_value * 1.0;
  elsif p_metric = 'streak' then
    select streak into v_value from public.user_profile where id = p_user_profile_id;
    v_composite_score := v_value * 100;  -- Weight streaks more heavily
  else
    raise exception 'Unknown metric: %', p_metric;
  end if;

  -- Get current ranking position
  select count(*) + 1 into v_rank_position
  from public.user_rank
  where (window_start is null or window_start >= p_window_start)
    and (window_end is null or window_end <= p_window_end)
    and composite_score > v_composite_score;

  -- Insert or update the rank record
  insert into public.user_rank (user_profile_id, metric, value, window_start, window_end, composite_score, rank_position)
  values (p_user_profile_id, p_metric, v_value, p_window_start, p_window_end, v_composite_score, v_rank_position)
  on conflict (user_profile_id, metric, window_start, window_end) do update
  set value = excluded.value,
      composite_score = excluded.composite_score,
      rank_position = excluded.rank_position,
      updated_at = now();

  return jsonb_build_object('value', v_value, 'composite_score', v_composite_score, 'rank_position', v_rank_position);
end;
$$;

-- Function to get leaderboard for a specific metric
create or replace function public.get_leaderboard(p_metric text, p_limit integer default 50, p_window_start timestamptz default null, p_window_end timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  leaderboard jsonb := '[]'::jsonb;
  user_record jsonb;
begin
  -- Build leaderboard
  for user_record in (
    select
      up.id,
      up.display_name,
      up.avatar_url,
      up.level,
      up.xp,
      up.streak,
      ur.value,
      ur.composite_score,
      ur.rank_position
    from public.user_profile up
    join public.user_rank ur on ur.user_profile_id = up.id
    where ur.metric = p_metric
      and (ur.window_start is null or ur.window_start >= p_window_start)
      and (ur.window_end is null or ur.window_end <= p_window_end)
    order by ur.composite_score desc
    limit p_limit
  ) loop
    leaderboard := leaderboard || jsonb_build_array(jsonb_build_object(
      'userId', user_record->>'id',
      'displayName', user_record->>'display_name',
      'avatarUrl', user_record->>'avatar_url',
      'level', user_record->>'level',
      'xp', user_record->>'xp',
      'streak', user_record->>'streak',
      'metricValue', user_record->>'value',
      'compositeScore', user_record->>'composite_score',
      'rankPosition', user_record->>'rank_position'
    ));
  end loop;

  return leaderboard;
end;
$$;

-- Enable RLS with policies that allow service_role full access (already granted)
-- Allow service_role to perform all operations

comment on table public.user_profile is 'Links auth.users to player profiles and stores gamified progress';
comment on table public.user_rank is 'Stores computed rankings for users across multiple metrics';
comment on table public.user_xp is 'Tracks XP gains per source for user profiles';
comment on table public.user_activity is 'Tracks user engagement and activity for streak calculations';