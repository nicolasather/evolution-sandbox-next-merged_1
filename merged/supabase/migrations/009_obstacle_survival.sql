-- 009_obstacle_survival.sql — ADDITIVE and reversible (see 009_obstacle_survival_down.sql).
-- Obstacle Survival (Game 3): an online, individual-device, fixed-tick movement game on top of the existing rooms / players / room_questions / submissions.
-- Same serverless-safe design as 007 (Tower Defense): no timers, no in-memory state; every request catches the match up with the pure engine and commits through
-- revision-locked SQL. Two kinds of state change, each with its own lock:
--   * session state (phase, points, perks, barrier, credits, results)  → os_commit   (revision CAS on os_sessions)
--   * one student's body (position, tick, cooldowns)                    → os_input    (revision CAS on that student's os_seats row, optionally with the session when an ability adds a squad effect)
-- Nothing existing is dropped, renamed or rewritten. projector_sessions and its allow-list are untouched. Every new table has RLS enabled with NO policies and no
-- anon/authenticated grants: only the server (service_role) reads or writes them, and every write goes through a SECURITY DEFINER function with `set search_path = public`.
-- Numbering note: 008 is Swarm Survival. Nothing here references 007 or 008 objects, so the three migrations apply in any order after 001–006.

-- 1. One match per room. `state` is the pure engine's JSON (no seed, no answer keys); `seed` is a separate private column. -------------------------------
create table if not exists public.os_sessions (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 host_id uuid not null references auth.users(id) on delete cascade,
 format text not null check (format in ('cooperative_escape','relay_race')),
 config jsonb not null,
 seed text not null check (char_length(seed) between 16 and 128),
 state jsonb not null,
 revision bigint not null default 0 check (revision >= 0),
 status text not null default 'active' check (status in ('active','finished')),
 rules_version integer not null default 1,
 spectator_hash text check (spectator_hash is null or char_length(spectator_hash) = 64),
 host_seen_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 finished_at timestamptz,
 constraint os_state_size check (pg_column_size(state) <= 400000),
 constraint os_state_shape check (jsonb_typeof(state) = 'object' and state ? 'phase' and state ? 'teams' and (state->>'rulesVersion')::int = rules_version)
);
create index if not exists os_sessions_host on public.os_sessions(host_id, created_at desc);
create index if not exists os_sessions_active on public.os_sessions(status) where status = 'active';

-- 2. One row per student: the body is advanced ONLY by validated input batches. ---------------------------------------------------------------------
create table if not exists public.os_seats (
 room_id uuid not null references public.rooms(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 body jsonb not null,
 revision bigint not null default 0 check (revision >= 0),
 validated_tick integer not null default 0 check (validated_tick >= 0),
 last_seen_at timestamptz not null default now(),
 joined_at timestamptz not null default now(),
 primary key (room_id, player_id),
 constraint os_body_size check (pg_column_size(body) <= 4000),
 constraint os_body_shape check (jsonb_typeof(body) = 'object' and body ? 'x' and body ? 'y' and body ? 'tick')
);

-- 3. Append-only command ledger for session changes. (room, actor, command) makes every command idempotent; (room, revision) orders them. ---------------
create table if not exists public.os_events (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 revision bigint not null,
 actor_key text not null check (char_length(actor_key) between 1 and 80),
 command_id text not null check (char_length(command_id) between 8 and 100),
 action text not null check (action ~ '^[a-z_:]{2,40}$'),
 payload jsonb not null default '{}'::jsonb,
 summary jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique (room_id, actor_key, command_id),
 unique (room_id, revision)
);
create index if not exists os_events_room on public.os_events(room_id, revision);

-- 4. Input batch ledger: the idempotency key of movement. Bounded retention (rows older than 2400 ticks behind the seat are removed on every write). --------
create table if not exists public.os_input_batches (
 room_id uuid not null references public.rooms(id) on delete cascade,
 seat_id uuid not null references public.players(id) on delete cascade,
 command_id text not null check (char_length(command_id) between 8 and 100),
 from_tick integer not null check (from_tick >= 1),
 to_tick integer not null check (to_tick >= from_tick),
 digest text not null check (char_length(digest) <= 64),
 seat_revision bigint not null,
 accepted_at timestamptz not null default now(),
 primary key (room_id, seat_id, command_id)
);
create index if not exists os_input_batches_tick on public.os_input_batches(room_id, seat_id, to_tick);

-- 5. Exactly-once credit of barrier answers into squad points. Key: b:<chapter>:<squad>. The primary key is the guarantee. ---------------------------------
create table if not exists public.os_credits (
 room_id uuid not null references public.rooms(id) on delete cascade,
 credit_key text not null check (char_length(credit_key) between 3 and 140),
 team_key text not null check (char_length(team_key) between 1 and 40),
 amount integer not null check (amount >= 0 and amount <= 100000),
 submission_ids text[] not null default '{}',
 created_at timestamptz not null default now(),
 primary key (room_id, credit_key)
);

-- 6. Final results: one row per squad, written once in the commit that finishes the match, never updated. -----------------------------------------------
create table if not exists public.os_results (
 room_id uuid not null references public.rooms(id) on delete cascade,
 team_key text not null check (char_length(team_key) between 1 and 40),
 team_name text not null,
 rank integer not null check (rank >= 1),
 outcome text not null check (char_length(outcome) <= 20),
 finish_reason text not null check (char_length(finish_reason) <= 20),
 progress integer not null check (progress between 0 and 1000),
 mastery integer not null check (mastery between 0 and 1000),
 teamwork integer not null check (teamwork between 0 and 1000),
 score integer not null check (score between 0 and 1000),
 points_spent integer not null check (points_spent >= 0),
 players integer not null check (players >= 0),
 summary jsonb not null default '{}'::jsonb,
 finalized_at timestamptz not null default now(),
 primary key (room_id, team_key)
);
create or replace function public.os_results_immutable() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Obstacle Survival results are final'; end; $$;
drop trigger if exists os_results_no_update on public.os_results;
create trigger os_results_no_update before update on public.os_results for each row execute function public.os_results_immutable();

-- 7. Outbox: one row per committed revision, for the realtime hint (clients always re-read the authoritative state). ----------------------------------------
create table if not exists public.os_outbox (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 revision bigint not null,
 category text not null check (char_length(category) <= 40),
 created_at timestamptz not null default now(),
 published_at timestamptz
);
create index if not exists os_outbox_room on public.os_outbox(room_id, id);

alter table public.os_sessions enable row level security;
alter table public.os_seats enable row level security;
alter table public.os_events enable row level security;
alter table public.os_input_batches enable row level security;
alter table public.os_credits enable row level security;
alter table public.os_results enable row level security;
alter table public.os_outbox enable row level security;
revoke all on public.os_sessions, public.os_seats, public.os_events, public.os_input_batches, public.os_credits, public.os_results, public.os_outbox from anon, authenticated;
grant select, insert, update, delete on public.os_sessions, public.os_seats, public.os_events, public.os_input_batches, public.os_credits, public.os_results, public.os_outbox to service_role;
grant usage on all sequences in schema public to service_role;

-- 8. Create the match (host only, online room, before it starts). ---------------------------------------------------------------------------------------
create or replace function public.os_create_session(p_room uuid, p_host uuid, p_format text, p_config jsonb, p_seed text, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.mode <> 'online' then raise exception 'Obstacle Survival runs in online rooms'; end if;
 if r.status <> 'waiting' then raise exception 'The game has already started'; end if;
 if not (r.config ? 'os') then raise exception 'This room was not created for Obstacle Survival'; end if;
 insert into os_sessions(room_id, host_id, format, config, seed, state, rules_version) values (p_room, p_host, p_format, p_config, p_seed, p_state, coalesce((p_state->>'rulesVersion')::int, 1));
 insert into os_events(room_id, revision, actor_key, command_id, action, payload, summary) values (p_room, 0, 'host', 'create-' || p_room::text, 'create', '{}'::jsonb, jsonb_build_object('format', p_format));
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'os_create', jsonb_build_object('format', p_format));
 return jsonb_build_object('ok', true, 'revision', 0);
exception when unique_violation then raise exception 'An Obstacle Survival match already exists for this room';
end; $$;

-- 9. The way SESSION state changes: revision-locked, idempotent, atomic with every room side effect, credit, new seat and final result. ----------------------
-- p_effects: [{type:'start'|'open'(position)|'reveal'|'pause'|'resume'|'end'|'kick'(seatId)}], p_credits: [{key,teamId,amount,submissionIds}],
-- p_results: [{teamKey,teamName,rank,outcome,finishReason,progress,mastery,teamwork,score,pointsSpent,players,summary}], p_seat: {playerId, body} for a join.
create or replace function public.os_commit(p_room uuid, p_actor text, p_command text, p_expected bigint, p_action text, p_payload jsonb, p_state jsonb,
  p_effects jsonb, p_credits jsonb, p_results jsonb, p_finished boolean, p_summary jsonb, p_seat jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s os_sessions%rowtype; r rooms%rowtype; v_prev os_events%rowtype; v_rev bigint; e jsonb; c jsonb; x jsonb; v_n integer; v_pos integer; v_shift interval; v_qid uuid;
begin
 select * into s from os_sessions where room_id = p_room for update;
 if not found then raise exception 'Obstacle Survival match not found'; end if;
 select * into v_prev from os_events where room_id = p_room and actor_key = p_actor and command_id = p_command;
 if found then return jsonb_build_object('ok', true, 'replayed', true, 'revision', v_prev.revision); end if;
 if s.revision <> p_expected then raise exception 'os_revision_conflict:%', s.revision; end if;
 if s.status = 'finished' then raise exception 'This match is finished'; end if;
 if p_state is null or jsonb_typeof(p_state) <> 'object' or not (p_state ? 'phase') then raise exception 'Invalid state'; end if;
 select * into r from rooms where id = p_room for update;
 for e in select * from jsonb_array_elements(coalesce(p_effects, '[]'::jsonb)) loop
  if e->>'type' = 'start' then
   if r.status = 'waiting' then
    update rooms set status = 'active', started_at = now(), round_opened_at = now(), revealed = true,
      expires_at = now() + make_interval(secs => coalesce((r.config->>'durationSeconds')::integer, 3600)) where id = p_room;
   end if;
  elsif e->>'type' = 'open' then
   v_pos := (e->>'position')::integer;
   select id into v_qid from room_questions where room_id = p_room and position = v_pos;
   if v_qid is null then raise exception 'Question not found'; end if;
   if exists (select 1 from submissions where room_question_id = v_qid) then raise exception 'That question was already used'; end if;
   update rooms set current_index = v_pos, round_opened_at = now(), revealed = false where id = p_room;
  elsif e->>'type' = 'reveal' then
   update rooms set revealed = true where id = p_room;
  elsif e->>'type' = 'pause' then
   update rooms set paused_at = coalesce(paused_at, now()) where id = p_room;
  elsif e->>'type' = 'resume' then
   select * into r from rooms where id = p_room;
   if r.paused_at is not null then
    v_shift := now() - r.paused_at;
    update rooms set paused_at = null, round_opened_at = round_opened_at + v_shift, expires_at = expires_at + v_shift where id = p_room;
   end if;
  elsif e->>'type' = 'end' then
   update rooms set status = 'ended', revealed = true, paused_at = null where id = p_room and status <> 'ended';
  elsif e->>'type' = 'kick' then
   update players set status = 'removed' where id = (e->>'seatId')::uuid and room_id = p_room;
  else raise exception 'Unknown effect';
  end if;
 end loop;
 for c in select * from jsonb_array_elements(coalesce(p_credits, '[]'::jsonb)) loop
  insert into os_credits(room_id, credit_key, team_key, amount, submission_ids)
  values (p_room, c->>'key', c->>'teamId', (c->>'amount')::integer, coalesce(array(select jsonb_array_elements_text(c->'submissionIds')), '{}'))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'os_credit_conflict:%', c->>'key'; end if;
 end loop;
 if p_seat is not null then
  insert into os_seats(room_id, player_id, body, validated_tick) values (p_room, (p_seat->>'playerId')::uuid, p_seat->'body', coalesce((p_seat->'body'->>'tick')::integer, 0)) on conflict do nothing;
 end if;
 for x in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
  insert into os_results(room_id, team_key, team_name, rank, outcome, finish_reason, progress, mastery, teamwork, score, points_spent, players, summary)
  values (p_room, x->>'teamKey', left(x->>'teamName', 40), (x->>'rank')::int, x->>'outcome', left(coalesce(x->>'finishReason', 'time_up'), 20), (x->>'progress')::int, (x->>'mastery')::int,
    (x->>'teamwork')::int, (x->>'score')::int, (x->>'pointsSpent')::int, (x->>'players')::int, coalesce(x->'summary', '{}'::jsonb));
 end loop;
 v_rev := s.revision + 1;
 update os_sessions set state = p_state, revision = v_rev, status = case when p_finished then 'finished' else 'active' end,
   finished_at = case when p_finished then now() else finished_at end, updated_at = now() where room_id = p_room;
 insert into os_events(room_id, revision, actor_key, command_id, action, payload, summary)
 values (p_room, v_rev, p_actor, p_command, left(p_action, 40), coalesce(p_payload, '{}'::jsonb), coalesce(p_summary, '{}'::jsonb));
 insert into os_outbox(room_id, revision, category) values (p_room, v_rev, left(p_action, 40));
 if p_actor = 'host' and p_action ~ '^host:(kick|end|pause|resume|lock|skip|move_seat)' then
  insert into audit_log(room_id, actor_id, action, detail) values (p_room, s.host_id, 'os_' || replace(p_action, 'host:', ''), coalesce(p_payload, '{}'::jsonb));
 end if;
 return jsonb_build_object('ok', true, 'replayed', false, 'revision', v_rev);
end; $$;

-- 10. The way a BODY changes: one student's validated input batch. Idempotent per (room, seat, command); CAS on the seat's own revision so two devices
-- (or a retry racing the original) can never apply the same ticks twice. When the batch used an ability with a squad effect the session row is updated in the SAME
-- transaction (p_state / p_session_rev), so the cooldown and the effect can never disagree.
create or replace function public.os_input(p_room uuid, p_seat uuid, p_command text, p_seat_rev bigint, p_body jsonb, p_from integer, p_to integer, p_digest text,
  p_session_rev bigint default null, p_state jsonb default null, p_summary jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s os_sessions%rowtype; q os_seats%rowtype; v_prev os_input_batches%rowtype; v_rev bigint;
begin
 select * into v_prev from os_input_batches where room_id = p_room and seat_id = p_seat and command_id = p_command;
 if found then return jsonb_build_object('ok', true, 'replayed', true, 'seatRevision', v_prev.seat_revision, 'toTick', v_prev.to_tick); end if;
 select * into q from os_seats where room_id = p_room and player_id = p_seat for update;
 if not found then raise exception 'os_no_seat'; end if;
 if q.revision <> p_seat_rev then raise exception 'os_seat_conflict:%', q.revision; end if;
 if p_to < p_from or p_to <= q.validated_tick then raise exception 'os_tick_conflict:%', q.validated_tick; end if;
 if p_state is not null then
  select * into s from os_sessions where room_id = p_room for update;
  if not found then raise exception 'Obstacle Survival match not found'; end if;
  if s.revision <> p_session_rev then raise exception 'os_revision_conflict:%', s.revision; end if;
  if s.status = 'finished' then raise exception 'This match is finished'; end if;
  v_rev := s.revision + 1;
  update os_sessions set state = p_state, revision = v_rev, updated_at = now() where room_id = p_room;
  insert into os_events(room_id, revision, actor_key, command_id, action, payload, summary) values (p_room, v_rev, p_seat::text, p_command, 'seat:ability', '{}'::jsonb, coalesce(p_summary, '{}'::jsonb));
  insert into os_outbox(room_id, revision, category) values (p_room, v_rev, 'seat:ability');
 else
  select * into s from os_sessions where room_id = p_room;
  if not found then raise exception 'Obstacle Survival match not found'; end if;
  if s.status = 'finished' then raise exception 'This match is finished'; end if;
 end if;
 update os_seats set body = p_body, revision = q.revision + 1, validated_tick = p_to, last_seen_at = now() where room_id = p_room and player_id = p_seat;
 insert into os_input_batches(room_id, seat_id, command_id, from_tick, to_tick, digest, seat_revision) values (p_room, p_seat, p_command, p_from, p_to, left(p_digest, 64), q.revision + 1);
 delete from os_input_batches where room_id = p_room and seat_id = p_seat and to_tick < p_to - 2400;
 return jsonb_build_object('ok', true, 'replayed', false, 'seatRevision', q.revision + 1, 'toTick', p_to, 'revision', coalesce(v_rev, s.revision));
end; $$;

-- 11. Presence and host heartbeat, throttled to at most one write per player every 8 s. ---------------------------------------------------------------------
create or replace function public.os_touch(p_room uuid, p_player uuid, p_host boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
 if p_host then
  update os_sessions set host_seen_at = now() where room_id = p_room and (host_seen_at is null or host_seen_at < now() - interval '8 seconds');
 elsif p_player is not null then
  update os_seats set last_seen_at = now() where room_id = p_room and player_id = p_player and last_seen_at < now() - interval '8 seconds';
 end if;
end; $$;

-- 12. A revocable, read-only projector link (only its SHA-256 is stored). ---------------------------------------------------------------------------------
create or replace function public.os_set_spectator(p_room uuid, p_host uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
 update os_sessions set spectator_hash = p_hash where room_id = p_room and host_id = p_host;
 if not found then raise exception 'Only the room host can perform this action'; end if;
 return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.os_create_session(uuid,uuid,text,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.os_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.os_input(uuid,uuid,text,bigint,jsonb,integer,integer,text,bigint,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.os_touch(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.os_set_spectator(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.os_results_immutable() from public, anon, authenticated;
grant execute on function public.os_create_session(uuid,uuid,text,jsonb,text,jsonb) to service_role;
grant execute on function public.os_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb) to service_role;
grant execute on function public.os_input(uuid,uuid,text,bigint,jsonb,integer,integer,text,bigint,jsonb,jsonb) to service_role;
grant execute on function public.os_touch(uuid,uuid,boolean) to service_role;
grant execute on function public.os_set_spectator(uuid,uuid,text) to service_role;
