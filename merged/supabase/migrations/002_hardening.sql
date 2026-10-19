-- 002_hardening.sql — additive, non-destructive hardening of the Classroom Quiz schema (run AFTER 001_init.sql).
-- Safe to run once on the existing project: it never drops tables or deletes rows. It
--   * lets quizzes with past games be deleted (rooms cascade) and lets solo guests play without an account,
--   * moves room creation / join / lifecycle control into single atomic, row-locked transactions,
--   * hardens commit_answer (reveal lock, solo completion, size limit) and apply_modifier (Potluck cap, audit meta),
--   * adds a rate limiter and a stale-data cleanup function.
-- All functions are SECURITY DEFINER and executable ONLY by service_role (never anon / authenticated).

-- 1. Foreign keys / nullability ---------------------------------------------------------------
alter table public.rooms drop constraint if exists rooms_quiz_id_fkey;
alter table public.rooms add constraint rooms_quiz_id_fkey foreign key (quiz_id) references public.quizzes(id) on delete cascade;
alter table public.rooms drop constraint if exists rooms_host_id_fkey;
alter table public.rooms add constraint rooms_host_id_fkey foreign key (host_id) references auth.users(id) on delete cascade;
alter table public.rooms alter column host_id drop not null;
alter table public.rooms drop constraint if exists rooms_host_required;
alter table public.rooms add constraint rooms_host_required check (mode = 'solo' or host_id is not null);
create index if not exists rooms_created on public.rooms(created_at);
create index if not exists submissions_actor on public.submissions(room_id, actor_type, actor_id);

-- 2. Rate limiter --------------------------------------------------------------------------------
create table if not exists public.rate_limits (
 key text primary key, window_start timestamptz not null default now(), hits integer not null default 0
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits integer;
begin
 insert into rate_limits(key, window_start, hits) values (left(p_key, 200), now(), 1)
 on conflict (key) do update set
  hits = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.hits + 1 end,
  window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end
 returning hits into v_hits;
 return v_hits <= p_max;
end; $$;

-- 3. Atomic room creation (copies an immutable question snapshot, teams and the solo player) --------
create or replace function public.create_room_with_content(
 p_host uuid, p_quiz uuid, p_mode text, p_flow text, p_config jsonb, p_code text, p_teams text[], p_player_hash text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_quiz quizzes%rowtype; v_room uuid; v_count integer; v_secs integer; v_player uuid; v_team_count integer; i integer;
begin
 select * into v_quiz from quizzes where id = p_quiz;
 if not found then raise exception 'Quiz unavailable'; end if;
 if v_quiz.status <> 'published' and (p_host is null or v_quiz.owner_id <> p_host) then raise exception 'Quiz unavailable'; end if;
 if p_mode <> 'solo' and p_host is null then raise exception 'Sign in required'; end if;
 select count(*) into v_count from quiz_questions where quiz_id = p_quiz;
 if v_count = 0 then raise exception 'Quiz contains no questions'; end if;
 v_team_count := coalesce(array_length(p_teams, 1), 0);
 if p_mode = 'classroom' and (v_team_count < 2 or v_team_count > 8) then raise exception 'Classroom requires 2-8 teams'; end if;
 if p_mode = 'solo' and p_player_hash is null then raise exception 'Player token required'; end if;
 v_secs := coalesce((p_config->>'durationSeconds')::integer, 900);
 insert into rooms(quiz_id, host_id, join_code, mode, flow, config, status, started_at, expires_at, round_opened_at)
 values (p_quiz, p_host, p_code, p_mode, p_flow, p_config,
  case when p_mode = 'solo' then 'active' else 'waiting' end,
  case when p_mode = 'solo' then now() end,
  case when p_mode = 'solo' then now() + make_interval(secs => v_secs) end,
  case when p_mode = 'solo' then now() end)
 returning id into v_room;
 insert into room_questions(room_id, position, kind, prompt, payload, answer_key, base_points)
 select v_room, position, kind, prompt, payload, answer_key, base_points from quiz_questions where quiz_id = p_quiz order by position;
 if p_mode = 'classroom' then
  for i in 1..v_team_count loop
   insert into teams(room_id, display_name, order_index) values (v_room, p_teams[i], i - 1);
  end loop;
 end if;
 if p_mode = 'solo' then
  insert into players(room_id, display_name, secret_hash, question_opened_at) values (v_room, 'You', p_player_hash, now()) returning id into v_player;
 end if;
 return jsonb_build_object('roomId', v_room, 'code', p_code, 'playerId', v_player);
end; $$;

-- 4. Atomic join (serialised on the room row so the 100-player cap is exact) ---------------------
create or replace function public.join_room(p_code text, p_name text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_count integer; v_player uuid;
begin
 select * into r from rooms where join_code = upper(p_code) for update;
 if not found or r.mode <> 'online' or r.status = 'ended' then raise exception 'This online room is not joinable'; end if;
 if r.expires_at is not null and now() > r.expires_at then raise exception 'This online room is not joinable'; end if;
 select count(*) into v_count from players where room_id = r.id;
 if v_count >= 100 then raise exception 'Room player limit reached'; end if;
 if exists (select 1 from players where room_id = r.id and lower(display_name) = lower(p_name)) then
  raise exception 'That display name is already taken in this room';
 end if;
 insert into players(room_id, display_name, secret_hash, question_opened_at)
 values (r.id, p_name, p_hash, case when r.status = 'active' then now() end) returning id into v_player;
 return jsonb_build_object('roomId', r.id, 'playerId', v_player);
end; $$;

-- 5. Host lifecycle control, one locked transaction per action ----------------------------------
create or replace function public.control_room(p_room uuid, p_host uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_total integer; v_teams integer; v_shift interval;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.mode = 'solo' then raise exception 'Solo games have no host controls'; end if;
 select count(*) into v_total from room_questions where room_id = p_room;
 if p_action = 'start' then
  if r.status <> 'waiting' then raise exception 'Room already started'; end if;
  update rooms set status = 'active', started_at = now(), round_opened_at = now(),
   expires_at = now() + make_interval(secs => coalesce((config->>'durationSeconds')::integer, 900)) where id = p_room;
  update players set question_opened_at = now() where room_id = p_room;
 elsif p_action = 'next' then
  if r.status <> 'active' or r.flow = 'independent' then raise exception 'Cannot advance this room'; end if;
  if r.paused_at is not null then raise exception 'Cannot advance while paused'; end if;
  if r.current_index + 1 >= v_total then
   update rooms set status = 'ended', revealed = true, steal_active = false, steal_target_id = null where id = p_room;
  else
   select count(*) into v_teams from teams where room_id = p_room;
   update rooms set current_index = current_index + 1,
    turn_index = case when r.mode = 'classroom' and r.flow = 'round_robin' and v_teams > 0 then (turn_index + 1) % v_teams else turn_index end,
    round_opened_at = now(), revealed = false, steal_active = false, steal_target_id = null where id = p_room;
  end if;
 elsif p_action = 'pause' then
  if r.status <> 'active' or r.paused_at is not null then raise exception 'Cannot pause'; end if;
  update rooms set paused_at = now() where id = p_room;
 elsif p_action = 'resume' then
  if r.paused_at is null then raise exception 'Room is not paused'; end if;
  v_shift := now() - r.paused_at;
  update rooms set paused_at = null, round_opened_at = round_opened_at + v_shift, expires_at = expires_at + v_shift where id = p_room;
  update players set question_opened_at = question_opened_at + v_shift where room_id = p_room and question_opened_at is not null;
 elsif p_action = 'reveal' then
  if r.status <> 'active' then raise exception 'Room is not active'; end if;
  if r.flow = 'independent' then raise exception 'Independent rooms reveal answers when the game ends'; end if;
  update rooms set revealed = true where id = p_room;
 elsif p_action = 'end' then
  update rooms set status = 'ended', revealed = true, paused_at = null, steal_active = false, steal_target_id = null where id = p_room;
 else
  raise exception 'Unsupported control action';
 end if;
 return jsonb_build_object('ok', true);
end; $$;

-- 6. Steal the Question (classroom round robin only) ---------------------------------------------
create or replace function public.set_steal(p_room uuid, p_host uuid, p_target uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; q room_questions%rowtype;
begin
 select * into r from rooms where id = p_room for update;
 if not found or r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.mode <> 'classroom' or r.flow <> 'round_robin' or not ((r.config->'modifiers') ? 'steal_question') then raise exception 'Steal the Question requires classroom round robin'; end if;
 if r.status <> 'active' or r.paused_at is not null or r.revealed then raise exception 'Room is not accepting answers'; end if;
 select * into q from room_questions where room_id = p_room and position = r.current_index;
 if not exists (select 1 from submissions where room_question_id = q.id and correct = false) then raise exception 'No incorrect answer to steal'; end if;
 if not exists (select 1 from teams where id = p_target and room_id = p_room) then raise exception 'Target absent'; end if;
 if exists (select 1 from submissions where room_question_id = q.id and actor_type = 'team' and actor_id = p_target) then raise exception 'That team has already answered'; end if;
 update rooms set steal_active = true, steal_target_id = p_target where id = p_room;
 return jsonb_build_object('stealTarget', p_target);
end; $$;

-- 7. Hardened commit_answer (same signature as 001) ---------------------------------------------
create or replace function public.commit_answer(
 p_room uuid,p_question uuid,p_actor_type text,p_actor uuid,p_response jsonb,
 p_correct boolean,p_base_award integer,p_wager integer,p_manual boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; q room_questions%rowtype; v_cursor integer; v_opened timestamptz;
 v_balance bigint; v_delta bigint; v_group uuid:=gen_random_uuid(); v_team_order integer;
 v_count integer; v_limit integer; v_deadline integer; v_total integer; v_finished boolean:=false;
begin
 if pg_column_size(p_response) > 20000 then raise exception 'Invalid response: too large'; end if;
 select * into r from rooms where id=p_room for update;
 if not found or r.status<>'active' or r.paused_at is not null then raise exception 'Room not active'; end if;
 if r.expires_at is not null and now()>r.expires_at then raise exception 'Match expired'; end if;
 if r.revealed and r.flow<>'independent' then raise exception 'Answer already revealed'; end if;
 select * into q from room_questions where id=p_question and room_id=p_room;
 if not found then raise exception 'Invalid question'; end if;
 if p_actor_type not in ('team','player') or (r.mode='classroom')<>(p_actor_type='team') then raise exception 'Wrong actor type'; end if;
 select count(*) into v_total from room_questions where room_id=p_room;
 if p_actor_type='team' then
  select points,order_index into v_balance,v_team_order from teams where id=p_actor and room_id=p_room for update;
  if not found then raise exception 'Team absent'; end if;
  v_cursor:=r.current_index; v_opened:=r.round_opened_at;
  if r.flow='round_robin' and v_team_order<>r.turn_index and not (r.steal_active and r.steal_target_id=p_actor) then raise exception 'Wrong turn'; end if;
 else
  select points,cursor_index,question_opened_at into v_balance,v_cursor,v_opened from players where id=p_actor and room_id=p_room for update;
  if not found then raise exception 'Player absent'; end if;
  if r.flow<>'independent' then v_cursor:=r.current_index; v_opened:=r.round_opened_at; end if;
 end if;
 if q.position<>v_cursor then raise exception 'Wrong question'; end if;
 if exists(select 1 from submissions where room_question_id=q.id and actor_type=p_actor_type and actor_id=p_actor) then raise exception 'Already submitted'; end if;
 v_deadline:=nullif(r.config->>'questionSeconds','')::integer;
 if v_deadline is not null and v_deadline>0 and (v_opened is null or now()>v_opened + make_interval(secs=>v_deadline)) then raise exception 'Question timer expired'; end if;
 if r.flow='synchronized' and (r.config->'modifiers') ? 'limited_slots' then
  v_limit:=coalesce((r.config->>'slotLimit')::integer,1);
  select count(*) into v_count from submissions where room_question_id=q.id;
  if v_count>=v_limit then raise exception 'All answer slots taken'; end if;
 end if;
 if p_wager<0 or p_wager>v_balance or p_wager>10000 then raise exception 'Invalid wager'; end if;
 if p_wager>0 and not ((r.config->'modifiers') ? 'secret_wager') then raise exception 'Wager disabled'; end if;
 if p_base_award<0 or p_base_award>q.base_points or (not p_correct and p_base_award<>0) or (p_correct and p_base_award<>q.base_points) then raise exception 'Invalid award'; end if;
 v_delta:=p_base_award + case when p_wager=0 then 0 when p_correct then p_wager else -p_wager end;
 insert into submissions(room_id,room_question_id,actor_type,actor_id,response,correct,base_awarded,wager,manual_override)
 values(p_room,q.id,p_actor_type,p_actor,p_response,p_correct,p_base_award,p_wager,p_manual);
 if p_actor_type='team' then update teams set points=points+v_delta where id=p_actor;
 else
  update players set points=points+v_delta,
    cursor_index=case when r.flow='independent' then cursor_index+1 else cursor_index end,
    question_opened_at=case when r.flow='independent' then now() else question_opened_at end
  where id=p_actor;
  if r.flow='independent' and v_cursor+1>=v_total then v_finished:=true; end if;
 end if;
 if v_delta<>0 then
  insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason,meta)
  values(p_room,v_group,p_actor_type,p_actor,v_delta,'answer',jsonb_build_object('pos',q.position));
 end if;
 if r.steal_active and r.steal_target_id=p_actor then update rooms set steal_active=false,steal_target_id=null where id=p_room; end if;
 if v_finished and r.mode='solo' then update rooms set status='ended',revealed=true where id=p_room; end if;
 return jsonb_build_object('correct',p_correct,'awarded',v_delta,'newPoints',v_balance+v_delta,'finished',v_finished);
end; $$;

-- 8. Hardened apply_modifier (same signature as 001): audit meta, Potluck cap, solo self-target ------
create or replace function public.apply_modifier(p_room uuid,p_kind text,p_target uuid,p_other uuid default null,p_amount integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r rooms%rowtype; v_type text; v_a bigint;v_b bigint;v_delta bigint;v_group uuid:=gen_random_uuid();v_max bigint;v_pos integer;
begin
 select * into r from rooms where id=p_room for update;
 if not found or r.status<>'active' or r.paused_at is not null then raise exception 'Room not active'; end if;
 if r.expires_at is not null and now()>r.expires_at then raise exception 'Match expired'; end if;
 if not ((r.config->'modifiers') ? p_kind) then raise exception 'Modifier not selected'; end if;
 if p_kind not in ('lose_all','go_to_first','steal_points','give_points','swap_points','potluck') then raise exception 'Modifier is not an instant point event'; end if;
 if r.mode='solo' and p_kind<>'potluck' then raise exception 'Modifier unavailable in solo play'; end if;
 v_type:=case when r.mode='classroom' then 'team' else 'player' end;
 if v_type='team' then select points into v_a from teams where id=p_target and room_id=p_room for update;
 else select points,case when r.flow='independent' then cursor_index else r.current_index end into v_a,v_pos from players where id=p_target and room_id=p_room for update; end if;
 if not found then raise exception 'Target absent'; end if;
 if v_type='team' then v_pos:=r.current_index; end if;
 if p_kind in ('steal_points','give_points','swap_points') then
  if p_other is null or p_other=p_target then raise exception 'Distinct opponent required'; end if;
  if v_type='team' then select points into v_b from teams where id=p_other and room_id=p_room for update;
  else select points into v_b from players where id=p_other and room_id=p_room for update; end if;
  if not found then raise exception 'Opponent absent'; end if;
 end if;
 if p_kind in ('steal_points','give_points') and (p_amount<1 or p_amount>10000) then raise exception 'Invalid transfer amount'; end if;
 if p_kind='potluck' and exists(select 1 from score_events where room_id=p_room and actor_id=p_target and reason='potluck' and undone_at is null and (meta->>'pos')::integer=v_pos) then
  raise exception 'Potluck can only be used once per question';
 end if;
 if p_kind='lose_all' then v_delta:=-v_a;
 elsif p_kind='go_to_first' then
  if v_type='team' then select coalesce(max(points),0) into v_max from teams where room_id=p_room;
  else select coalesce(max(points),0) into v_max from players where room_id=p_room; end if;
  v_delta:=greatest(0,v_max-v_a);
 elsif p_kind='potluck' then
  v_delta:=floor(random()*401)::bigint-200;
  v_delta:=greatest(-v_a,v_delta);
 elsif p_kind='steal_points' then v_delta:=least(p_amount,v_b);
 elsif p_kind='give_points' then v_delta:=-least(p_amount,v_a);
 elsif p_kind='swap_points' then v_delta:=v_b-v_a;
 end if;
 if v_type='team' then update teams set points=points+v_delta where id=p_target;
 else update players set points=points+v_delta where id=p_target; end if;
 insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason,meta)
 values(p_room,v_group,v_type,p_target,v_delta,p_kind,jsonb_build_object('pos',v_pos));
 if p_kind in ('steal_points','give_points','swap_points') then
  if v_type='team' then update teams set points=points-v_delta where id=p_other;
  else update players set points=points-v_delta where id=p_other; end if;
  insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason,meta)
  values(p_room,v_group,v_type,p_other,-v_delta,p_kind,jsonb_build_object('pos',v_pos));
 end if;
 return jsonb_build_object('modifier',p_kind,'change',v_delta,'groupId',v_group);
end; $$;

-- 9. Independent-flow timeout: move a player past an unanswered, expired question ------------------
create or replace function public.skip_if_timed_out(p_room uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; pl players%rowtype; q room_questions%rowtype; v_deadline integer; v_total integer; v_skipped boolean:=false;
begin
 select * into r from rooms where id=p_room for update;
 if not found or r.flow<>'independent' or r.status<>'active' or r.paused_at is not null then return jsonb_build_object('skipped',false); end if;
 v_deadline:=nullif(r.config->>'questionSeconds','')::integer;
 if v_deadline is null or v_deadline<=0 then return jsonb_build_object('skipped',false); end if;
 select * into pl from players where id=p_player and room_id=p_room for update;
 if not found or pl.question_opened_at is null or now()<=pl.question_opened_at + make_interval(secs=>v_deadline) then return jsonb_build_object('skipped',false); end if;
 select * into q from room_questions where room_id=p_room and position=pl.cursor_index;
 if not found then return jsonb_build_object('skipped',false); end if;
 if not exists(select 1 from submissions where room_question_id=q.id and actor_type='player' and actor_id=p_player) then
  insert into submissions(room_id,room_question_id,actor_type,actor_id,response,correct,base_awarded,wager,manual_override)
  values(p_room,q.id,'player',p_player,'{"kind":"timeout"}'::jsonb,false,0,0,false);
  update players set cursor_index=cursor_index+1, question_opened_at=now() where id=p_player;
  v_skipped:=true;
  select count(*) into v_total from room_questions where room_id=p_room;
  if r.mode='solo' and pl.cursor_index+1>=v_total then update rooms set status='ended',revealed=true where id=p_room; end if;
 end if;
 return jsonb_build_object('skipped',v_skipped);
end; $$;

-- 10. End a match whose clock has run out -----------------------------------------------------------
create or replace function public.finalize_if_expired(p_room uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
 update rooms set status='ended', revealed=true, paused_at=null where id=p_room and status='active' and paused_at is null and expires_at is not null and now()>expires_at;
 return found;
end; $$;

-- 11. Scheduled cleanup of stale rooms / limiter rows (called by a protected cron route) -------------
create or replace function public.cleanup_stale_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rooms integer; v_limits integer;
begin
 delete from rooms where (status='ended' and created_at < now() - interval '30 days')
  or (status='waiting' and created_at < now() - interval '2 days')
  or (created_at < now() - interval '90 days');
 get diagnostics v_rooms = row_count;
 delete from rate_limits where window_start < now() - interval '1 day';
 get diagnostics v_limits = row_count;
 return jsonb_build_object('roomsDeleted', v_rooms, 'rateLimitRowsDeleted', v_limits);
end; $$;

-- 12. Privileges: service_role only ----------------------------------------------------------------
revoke all on function public.hit_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.create_room_with_content(uuid,uuid,text,text,jsonb,text,text[],text) from public,anon,authenticated;
revoke all on function public.join_room(text,text,text) from public,anon,authenticated;
revoke all on function public.control_room(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.set_steal(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.commit_answer(uuid,uuid,text,uuid,jsonb,boolean,integer,integer,boolean) from public,anon,authenticated;
revoke all on function public.apply_modifier(uuid,text,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.skip_if_timed_out(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finalize_if_expired(uuid) from public,anon,authenticated;
revoke all on function public.cleanup_stale_data() from public,anon,authenticated;
grant execute on function public.hit_rate_limit(text,integer,integer) to service_role;
grant execute on function public.create_room_with_content(uuid,uuid,text,text,jsonb,text,text[],text) to service_role;
grant execute on function public.join_room(text,text,text) to service_role;
grant execute on function public.control_room(uuid,uuid,text) to service_role;
grant execute on function public.set_steal(uuid,uuid,uuid) to service_role;
grant execute on function public.commit_answer(uuid,uuid,text,uuid,jsonb,boolean,integer,integer,boolean) to service_role;
grant execute on function public.apply_modifier(uuid,text,uuid,uuid,integer) to service_role;
grant execute on function public.skip_if_timed_out(uuid,uuid) to service_role;
grant execute on function public.finalize_if_expired(uuid) to service_role;
grant execute on function public.cleanup_stale_data() to service_role;
