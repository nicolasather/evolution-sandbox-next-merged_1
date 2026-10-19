-- 005_projector_modes.sql — ADDITIVE and reversible (see 005_projector_modes_down.sql).
-- Adds the five classroom projector games (Empire Race, Boss Battle, Escape Room, Treasure Vault, Risk Ladder) on top of the
-- existing rooms / room_questions / submissions / teams. Nothing existing is dropped, renamed or rewritten, so the app keeps
-- working before and after this runs. Every new table has RLS enabled with NO policies and no anon/authenticated grants: only the
-- server (service_role) touches them, and every write goes through a SECURITY DEFINER function that re-checks host ownership.

-- 1. One game session per room (state is the pure reducer's JSON; `revision` is the optimistic lock) ----------------------------
create table if not exists public.projector_sessions (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 game text not null check (game in ('empire_race','boss_battle','escape_room','treasure_vault','risk_ladder')),
 config jsonb not null default '{}'::jsonb,
 state jsonb not null,
 revision integer not null default 0 check (revision >= 0),
 status text not null default 'active' check (status in ('active','finished')),
 rules_version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint projector_state_size check (pg_column_size(state) <= 600000)
);

-- 2. Append-only event log; (room_id, command_id) makes every teacher command idempotent ------------------------------------
create table if not exists public.projector_events (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 revision integer not null,
 command_id text not null check (char_length(command_id) between 8 and 80),
 action text not null check (char_length(action) <= 40),
 actor_id uuid,
 payload jsonb not null default '{}'::jsonb,
 summary jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique (room_id, command_id),
 unique (room_id, revision)
);
create index if not exists projector_events_room on public.projector_events(room_id, id);

-- 3. Teaching evidence, reward ledger and appeals (strict, server-verified, never client-claimed) -----------------------------
create table if not exists public.projector_teaching_evidence (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null unique references public.rooms(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 game text not null,
 started_at timestamptz not null, ended_at timestamptz not null,
 verified_answers integer not null check (verified_answers >= 0),
 distinct_questions integer not null check (distinct_questions >= 0),
 active_minutes integer not null check (active_minutes >= 0),
 teams integer not null,
 verdict text not null check (verdict in ('accepted','rejected')),
 reasons jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists projector_evidence_owner on public.projector_teaching_evidence(owner_id, started_at);
create table if not exists public.projector_reward_ledger (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 evidence_id uuid not null unique references public.projector_teaching_evidence(id) on delete cascade,
 kind text not null check (kind in ('teaching_stars','revoked')),
 amount integer not null,
 created_at timestamptz not null default now()
);
create table if not exists public.projector_reward_appeals (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null references public.projector_teaching_evidence(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (char_length(reason) between 10 and 1000),
 status text not null default 'received' check (status in ('received','in_review','upheld','overturned')),
 resolution text not null default '',
 created_at timestamptz not null default now(),
 unique (evidence_id)
);

alter table public.projector_sessions enable row level security;
alter table public.projector_events enable row level security;
alter table public.projector_teaching_evidence enable row level security;
alter table public.projector_reward_ledger enable row level security;
alter table public.projector_reward_appeals enable row level security;
revoke all on public.projector_sessions, public.projector_events, public.projector_teaching_evidence, public.projector_reward_ledger, public.projector_reward_appeals from anon, authenticated;
grant select, insert, update, delete on public.projector_sessions, public.projector_events, public.projector_teaching_evidence, public.projector_reward_ledger, public.projector_reward_appeals to service_role;
grant usage on all sequences in schema public to service_role;

-- 4. Create the session (host only, classroom, before the match starts) --------------------------------------------------------
create or replace function public.projector_create_session(p_room uuid, p_host uuid, p_game text, p_config jsonb, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.mode <> 'classroom' then raise exception 'Projector games run in classroom rooms'; end if;
 if r.status <> 'waiting' then raise exception 'The game has already started'; end if;
 insert into projector_sessions(room_id, game, config, state) values (p_room, p_game, coalesce(p_config,'{}'::jsonb), p_state);
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'projector_create', jsonb_build_object('game', p_game));
 return jsonb_build_object('ok', true, 'revision', 0);
exception when unique_violation then raise exception 'A projector game already exists for this room';
end; $$;

-- 5. Revision-locked, idempotent commit of one teacher command ------------------------------------------------------------------
-- Replaying the same command id returns the stored result and changes nothing. A stale revision is refused with 'revision_conflict'.
create or replace function public.projector_commit(p_room uuid, p_host uuid, p_command text, p_expected integer, p_action text, p_payload jsonb, p_state jsonb, p_summary jsonb, p_finished boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s projector_sessions%rowtype; r rooms%rowtype; v_prev projector_events%rowtype; v_rev integer;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 select * into s from projector_sessions where room_id = p_room for update;
 if not found then raise exception 'Projector game not found'; end if;
 select * into v_prev from projector_events where room_id = p_room and command_id = p_command;
 if found then return jsonb_build_object('ok', true, 'replayed', true, 'revision', v_prev.revision, 'summary', v_prev.summary); end if;
 if s.revision <> p_expected then raise exception 'revision_conflict:%', s.revision; end if;
 if s.status = 'finished' then raise exception 'This game is finished'; end if;
 v_rev := s.revision + 1;
 update projector_sessions set state = p_state, revision = v_rev, status = case when p_finished then 'finished' else 'active' end, updated_at = now() where room_id = p_room;
 insert into projector_events(room_id, revision, command_id, action, actor_id, payload, summary) values (p_room, v_rev, p_command, p_action, p_host, coalesce(p_payload,'{}'::jsonb), coalesce(p_summary,'{}'::jsonb));
 if p_finished and r.status <> 'ended' then
  update rooms set status = 'ended', revealed = true, paused_at = null, steal_active = false, steal_target_id = null where id = p_room;
 end if;
 return jsonb_build_object('ok', true, 'replayed', false, 'revision', v_rev);
end; $$;

-- 6. Open a question for the asked teams (moves the room's shared cursor; submissions still go through commit_answer_v2) ------------
create or replace function public.projector_open_question(p_room uuid, p_host uuid, p_position integer, p_team_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; q room_questions%rowtype; v_order integer;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.status <> 'active' or r.paused_at is not null then raise exception 'The game is not running'; end if;
 if not exists (select 1 from projector_sessions where room_id = p_room and status = 'active') then raise exception 'Projector game not found'; end if;
 select * into q from room_questions where room_id = p_room and position = p_position;
 if not found then raise exception 'Question not found'; end if;
 if exists (select 1 from submissions where room_question_id = q.id) then raise exception 'That question was already used'; end if;
 if array_length(p_team_ids, 1) is null or exists (select 1 from unnest(p_team_ids) t where not exists (select 1 from teams where id = t and room_id = p_room)) then raise exception 'Team not found in this room'; end if;
 if r.flow = 'round_robin' then
  if array_length(p_team_ids, 1) <> 1 then raise exception 'Round robin asks one team at a time'; end if;
  select order_index into v_order from teams where id = p_team_ids[1];
 end if;
 update rooms set current_index = p_position, round_opened_at = now(), revealed = false, steal_active = false, steal_target_id = null,
   turn_index = coalesce(v_order, turn_index) where id = p_room;
 return jsonb_build_object('roomQuestionId', q.id, 'position', p_position);
end; $$;

-- 7. Extend the time cap (audited, bounded) ---------------------------------------------------------------------------------------
create or replace function public.projector_extend_time(p_room uuid, p_host uuid, p_minutes integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
 if p_minutes is null or p_minutes < 1 or p_minutes > 60 then raise exception 'Extend by 1 to 60 minutes'; end if;
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.status <> 'active' then raise exception 'The game is not running'; end if;
 update rooms set expires_at = coalesce(expires_at, now()) + make_interval(mins => p_minutes) where id = p_room;
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'projector_extend', jsonb_build_object('minutes', p_minutes, 'why', left(coalesce(p_reason,''), 200)));
 return jsonb_build_object('ok', true);
end; $$;

-- 8. Labelled repeat cycle: only with the teacher's explicit consent, clones question rows at new positions ------------------------
create or replace function public.projector_add_repeat_cycle(p_room uuid, p_host uuid, p_consent boolean, p_count integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_max integer; v_n integer; v_added integer;
begin
 if p_consent is not true then raise exception 'The teacher must agree to repeat questions'; end if;
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 select coalesce(max(position), -1) into v_max from room_questions where room_id = p_room;
 v_n := least(coalesce(p_count, v_max + 1), v_max + 1, 200);
 insert into room_questions(room_id, position, kind, prompt, payload, answer_key, base_points)
 select p_room, v_max + 1 + (row_number() over (order by position)) - 1, kind, prompt,
   jsonb_set(payload, '{meta}', coalesce(payload->'meta','{}'::jsonb) || jsonb_build_object('repeatOf', position), true), answer_key, base_points
 from room_questions where room_id = p_room and position <= v_max and not (coalesce(payload->'meta','{}'::jsonb) ? 'repeatOf') order by position limit v_n;
 get diagnostics v_added = row_count;
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'projector_repeat_cycle', jsonb_build_object('added', v_added));
 return jsonb_build_object('added', v_added, 'total', v_max + 1 + v_added);
end; $$;

-- 9. Reward evaluation: strict, server-verified, unique per room, anti-idle, anti-overlap -----------------------------------------
-- Evidence is computed here from committed submissions only. Nothing the browser sends is trusted.
create or replace function public.projector_evaluate_reward(p_room uuid, p_host uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; s projector_sessions%rowtype; v_ev uuid; v_answers integer; v_distinct integer; v_first timestamptz; v_last timestamptz;
 v_active integer; v_teams integer; v_reasons jsonb:='[]'::jsonb; v_ok boolean:=true; v_amount integer; v_existing projector_teaching_evidence%rowtype; v_span integer; v_overlap integer;
begin
 select * into r from rooms where id = p_room;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 select * into s from projector_sessions where room_id = p_room;
 if not found then raise exception 'Projector game not found'; end if;
 select * into v_existing from projector_teaching_evidence where room_id = p_room;
 if found then return jsonb_build_object('evidenceId', v_existing.id, 'verdict', v_existing.verdict, 'reasons', v_existing.reasons, 'duplicate', true); end if;
 if s.status <> 'finished' or r.status <> 'ended' then raise exception 'Finish the game before claiming a reward'; end if;
 select count(*), count(distinct room_question_id), min(submitted_at), max(submitted_at) into v_answers, v_distinct, v_first, v_last from submissions where room_id = p_room;
 select count(*) into v_teams from teams where room_id = p_room;
 -- active minutes = distinct 2-minute windows that contain at least one committed answer (idle stretches do not count)
 select count(distinct floor(extract(epoch from submitted_at) / 120)) * 2 into v_active from submissions where room_id = p_room;
 v_span := case when v_first is null then 0 else greatest(0, round(extract(epoch from (v_last - v_first)) / 60)::integer) end;
 if v_answers < 6 then v_ok := false; v_reasons := v_reasons || '"tooFewAnswers"'::jsonb; end if;
 if v_distinct < 5 then v_ok := false; v_reasons := v_reasons || '"tooFewQuestions"'::jsonb; end if;
 if v_active < 6 then v_ok := false; v_reasons := v_reasons || '"tooShort"'::jsonb; end if;
 if v_span > 0 and v_active * 3 < v_span then v_ok := false; v_reasons := v_reasons || '"mostlyIdle"'::jsonb; end if;
 select count(*) into v_overlap from projector_teaching_evidence e where e.owner_id = p_host and e.verdict = 'accepted' and tstzrange(e.started_at, e.ended_at) && tstzrange(coalesce(v_first, now()), coalesce(v_last, now()) + interval '1 second');
 if v_overlap > 0 then v_ok := false; v_reasons := v_reasons || '"overlapsAnotherSession"'::jsonb; end if;
 insert into projector_teaching_evidence(room_id, owner_id, game, started_at, ended_at, verified_answers, distinct_questions, active_minutes, teams, verdict, reasons)
 values (p_room, p_host, s.game, coalesce(v_first, now()), coalesce(v_last, now()), v_answers, v_distinct, v_active, v_teams, case when v_ok then 'accepted' else 'rejected' end, v_reasons)
 returning id into v_ev;
 if v_ok then
  v_amount := least(12, greatest(1, v_active / 10));
  insert into projector_reward_ledger(owner_id, evidence_id, kind, amount) values (p_host, v_ev, 'teaching_stars', v_amount);
 end if;
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'projector_reward', jsonb_build_object('verdict', case when v_ok then 'accepted' else 'rejected' end, 'reasons', v_reasons));
 return jsonb_build_object('evidenceId', v_ev, 'verdict', case when v_ok then 'accepted' else 'rejected' end, 'reasons', v_reasons, 'amount', case when v_ok then v_amount else 0 end, 'duplicate', false);
end; $$;

create or replace function public.projector_appeal_reward(p_owner uuid, p_evidence uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
 if not exists (select 1 from projector_teaching_evidence where id = p_evidence and owner_id = p_owner and verdict = 'rejected') then raise exception 'Only your own rejected evaluations can be appealed'; end if;
 insert into projector_reward_appeals(evidence_id, owner_id, reason) values (p_evidence, p_owner, p_reason);
 return jsonb_build_object('ok', true);
exception when unique_violation then raise exception 'This evaluation was already appealed';
end; $$;

-- 10. Privileges: SQL functions are callable by the server only ---------------------------------------------------------------------
revoke all on function public.projector_create_session(uuid,uuid,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.projector_commit(uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,boolean) from public, anon, authenticated;
revoke all on function public.projector_open_question(uuid,uuid,integer,uuid[]) from public, anon, authenticated;
revoke all on function public.projector_extend_time(uuid,uuid,integer,text) from public, anon, authenticated;
revoke all on function public.projector_add_repeat_cycle(uuid,uuid,boolean,integer) from public, anon, authenticated;
revoke all on function public.projector_evaluate_reward(uuid,uuid) from public, anon, authenticated;
revoke all on function public.projector_appeal_reward(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.projector_create_session(uuid,uuid,text,jsonb,jsonb) to service_role;
grant execute on function public.projector_commit(uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,boolean) to service_role;
grant execute on function public.projector_open_question(uuid,uuid,integer,uuid[]) to service_role;
grant execute on function public.projector_extend_time(uuid,uuid,integer,text) to service_role;
grant execute on function public.projector_add_repeat_cycle(uuid,uuid,boolean,integer) to service_role;
grant execute on function public.projector_evaluate_reward(uuid,uuid) to service_role;
grant execute on function public.projector_appeal_reward(uuid,uuid,text) to service_role;
