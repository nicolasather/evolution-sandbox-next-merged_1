-- 008_performance_and_rank_upgrades.sql — High-Performance Speed, FPS, Ranking & Caching Upgrades
-- Adds optimized database indexes, fast ranking calculation functions, materialized views,
-- and batch processing routines to boost system throughput and responsiveness.

-- 1. Performance Indexes for User Ranks & Profiles (Upgrades 1-10)
create index if not exists idx_user_profile_xp_desc on public.user_profile(xp desc);
create index if not exists idx_user_profile_streak_desc on public.user_profile(streak desc);
create index if not exists idx_user_profile_level_xp on public.user_profile(level desc, xp desc);
create index if not exists idx_user_rank_metric_composite on public.user_rank(metric, composite_score desc);
create index if not exists idx_user_xp_recorded_at_desc on public.user_xp(recorded_at desc);
create index if not exists idx_user_activity_type_profile on public.user_activity(activity_type, user_profile_id);
create index if not exists idx_rooms_status_created on public.rooms(status, created_at desc);
create index if not exists idx_players_room_score on public.players(room_id, score desc);
create index if not exists idx_score_events_room_player on public.score_events(room_id, player_id);

-- 2. Materialized View for Instant Leaderboard Reads (Upgrades 11-20)
create materialized view if not exists public.mv_global_leaderboard as
select
  p.id as user_profile_id,
  p.auth_user_id,
  p.display_name,
  p.avatar_url,
  p.xp,
  p.level,
  p.streak,
  coalesce(r.composite_score, p.xp::decimal) as composite_score,
  row_number() over (order by coalesce(r.composite_score, p.xp::decimal) desc, p.xp desc) as global_rank,
  p.last_active_at
from public.user_profile p
left join public.user_rank r on r.user_profile_id = p.id and r.metric = 'overall' and r.window_start is null
order by composite_score desc, xp desc;

create unique index if not exists mv_global_leaderboard_id on public.mv_global_leaderboard(user_profile_id);
create index if not exists mv_global_leaderboard_rank on public.mv_global_leaderboard(global_rank);

-- Function to refresh leaderboard view with high concurrency support
create or replace function public.refresh_global_leaderboard()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.mv_global_leaderboard;
exception when others then
  refresh materialized view public.mv_global_leaderboard;
end;
$$;

-- 3. High-Speed Batch XP & Ranking Update Function (Upgrades 21-35)
create or replace function public.batch_award_xp_and_rank(
  p_user_profile_id uuid,
  p_xp_amount integer,
  p_source text,
  p_room_id uuid default null,
  p_question_id text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_new_xp bigint;
  v_new_level integer;
  v_old_level integer;
  v_new_rank integer;
begin
  -- Insert XP record
  insert into public.user_xp (user_profile_id, source, amount, room_id, question_id)
  values (p_user_profile_id, p_source, p_xp_amount, p_room_id, p_question_id);

  -- Update user profile XP and compute level (Level up every 1000 XP)
  update public.user_profile
  set
    xp = xp + p_xp_amount,
    level = greatest(1, ((xp + p_xp_amount) / 1000) + 1),
    updated_at = now()
  where id = p_user_profile_id
  returning xp, level into v_new_xp, v_new_level;

  -- Upsert overall rank composite score
  insert into public.user_rank (user_profile_id, metric, value, composite_score, updated_at)
  values (p_user_profile_id, 'overall', v_new_xp, v_new_xp::decimal + (v_new_level * 500), now())
  on conflict (user_profile_id, metric, window_start, window_end)
  where window_start is null and window_end is null
  do update set
    value = excluded.value,
    composite_score = excluded.composite_score,
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'new_xp', v_new_xp,
    'new_level', v_new_level
  );
end;
$$;
