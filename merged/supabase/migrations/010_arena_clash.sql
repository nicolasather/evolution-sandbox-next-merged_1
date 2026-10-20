-- 010_arena_clash.sql — ADDITIVE and reversible (see 010_arena_clash_down.sql).
-- Arena Clash (Game 4, protocol arena/1): team-versus-team objective play on top of the existing rooms / players / room_questions / submissions.
-- NOT APPLIED to any database by the author of this file. Applying it to production needs the owner's approval; it was written against 001–009 and nothing in it
-- references 007/008/009 objects, so it applies in any order after 001–006.
--
-- Design (same serverless-safe contract as 007 and 009, plus the lease fencing a persistent worker would need):
--   * session state (phase, wallets, zones, banner, crystals, standings)  → arena_commit / arena_tick (revision CAS on arena_sessions)
--   * one student's steering intent (a direction, never a position)       → arena_input  (CAS on that student's own arena_seats row; no contention with other seats)
--   * an optional persistent realtime worker may hold a fenced lease      → arena_acquire_lease / arena_save_checkpoint (stale owners are refused)
-- Every new table has RLS enabled with NO policies and no anon/authenticated grants: only the server (service_role) reads or writes them. Every write goes through a
-- SECURITY DEFINER function with `set search_path = public`. No player e-mail, location or free text is stored; student names are the nicknames the room already holds.
-- Answers are NOT duplicated here: grades live in the existing `submissions` rows (unique per question and player) and are read back as immutable facts.

create table if not exists public.arena_sessions (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 host_id uuid not null references auth.users(id) on delete cascade,
 format text not null check (format in ('control','relay','crystal')),
 protocol text not null default 'arena/1' check (protocol = 'arena/1'),
 config jsonb not null,
 seed text not null check (char_length(seed) between 16 and 128),
 state jsonb not null,
 revision bigint not null default 0 check (revision >= 0),
 status text not null default 'active' check (status in ('active','finished')),
 rules_version integer not null default 1,
 lease_owner text check (lease_owner is null or char_length(lease_owner) between 8 and 80),
 lease_epoch bigint not null default 0 check (lease_epoch >= 0),
 lease_until timestamptz,
 spectator_hash text check (spectator_hash is null or char_length(spectator_hash) = 64),
 host_seen_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 finished_at timestamptz,
 constraint arena_state_size check (pg_column_size(state) <= 400000),
 constraint arena_state_shape check (jsonb_typeof(state) = 'object' and state ? 'phase' and state ? 'teams' and state ? 'seats' and (state->>'rulesVersion')::int = rules_version and state->>'protocol' = protocol)
);
create index if not exists arena_sessions_host on public.arena_sessions(host_id, created_at desc);
create index if not exists arena_sessions_active on public.arena_sessions(status) where status = 'active';

-- One row per student: ONLY steering intents live here. `intents` is the last few {tick,x,y,seq} entries; positions are derived by the server world, never stored from a client.
create table if not exists public.arena_seats (
 room_id uuid not null references public.rooms(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 intents jsonb not null default '[]'::jsonb,
 last_seq bigint not null default 0 check (last_seq >= 0),
 revision bigint not null default 0 check (revision >= 0),
 last_input_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 joined_at timestamptz not null default now(),
 primary key (room_id, player_id),
 constraint arena_intents_shape check (jsonb_typeof(intents) = 'array' and jsonb_array_length(intents) <= 24),
 constraint arena_intents_size check (pg_column_size(intents) <= 4000)
);

-- Append-only command ledger for session changes: (room, actor, command) is the idempotency key, (room, revision) orders them. World ticks write no event rows.
create table if not exists public.arena_events (
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
create index if not exists arena_events_room on public.arena_events(room_id, revision);

-- Exactly-once wallet grants from quiz questions. Key: q:<cycle>:<team>. The primary key is the guarantee (arena_awards in the design notes).
create table if not exists public.arena_awards (
 room_id uuid not null references public.rooms(id) on delete cascade,
 credit_key text not null check (char_length(credit_key) between 3 and 140),
 team_key text not null check (char_length(team_key) between 1 and 40),
 amount integer not null check (amount >= 0 and amount <= 1000),
 submission_ids text[] not null default '{}',
 created_at timestamptz not null default now(),
 primary key (room_id, credit_key)
);

-- Helper purchases: at most ONE per team per planning phase, enforced by the primary key (a replayed or racing second buy fails atomically).
create table if not exists public.arena_purchases (
 room_id uuid not null references public.rooms(id) on delete cascade,
 cycle integer not null check (cycle >= 0 and cycle < 200),
 team_key text not null check (char_length(team_key) between 1 and 40),
 helper text not null check (helper in ('trail_speed','capture_marker','route_reveal','deposit_guidance')),
 cost integer not null check (cost between 0 and 1000),
 player_id uuid,
 created_at timestamptz not null default now(),
 primary key (room_id, cycle, team_key)
);

-- Final standings: one row per team, written once in the commit that finishes the match, never updated.
create table if not exists public.arena_results (
 room_id uuid not null references public.rooms(id) on delete cascade,
 team_key text not null check (char_length(team_key) between 1 and 40),
 team_name text not null,
 rank integer not null check (rank >= 1),
 tied boolean not null default false,
 finish_reason text not null check (char_length(finish_reason) <= 20),
 score integer not null check (score between 0 and 1000),
 quiz integer not null check (quiz between 0 and 1000),
 objective integer not null check (objective between 0 and 1000),
 points_spent integer not null check (points_spent >= 0),
 players integer not null check (players >= 0),
 summary jsonb not null default '{}'::jsonb,
 finalized_at timestamptz not null default now(),
 primary key (room_id, team_key)
);
create or replace function public.arena_results_immutable() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Arena Clash results are final'; end; $$;
drop trigger if exists arena_results_no_update on public.arena_results;
create trigger arena_results_no_update before update on public.arena_results for each row execute function public.arena_results_immutable();

create table if not exists public.arena_outbox (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 revision bigint not null,
 category text not null check (char_length(category) <= 40),
 created_at timestamptz not null default now(),
 published_at timestamptz
);
create index if not exists arena_outbox_room on public.arena_outbox(room_id, id);

alter table public.arena_sessions enable row level security;
alter table public.arena_seats enable row level security;
alter table public.arena_events enable row level security;
alter table public.arena_awards enable row level security;
alter table public.arena_purchases enable row level security;
alter table public.arena_results enable row level security;
alter table public.arena_outbox enable row level security;
revoke all on public.arena_sessions, public.arena_seats, public.arena_events, public.arena_awards, public.arena_purchases, public.arena_results, public.arena_outbox from anon, authenticated;
grant select, insert, update, delete on public.arena_sessions, public.arena_seats, public.arena_events, public.arena_awards, public.arena_purchases, public.arena_results, public.arena_outbox to service_role;
grant usage on all sequences in schema public to service_role;

-- Create the match (host only, online room, before it starts).
create or replace function public.arena_create_session(p_room uuid, p_host uuid, p_format text, p_config jsonb, p_seed text, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.mode <> 'online' then raise exception 'Arena Clash runs in online rooms'; end if;
 if r.status <> 'waiting' then raise exception 'The game has already started'; end if;
 if not (r.config ? 'arena') then raise exception 'This room was not created for Arena Clash'; end if;
 insert into arena_sessions(room_id, host_id, format, config, seed, state, rules_version) values (p_room, p_host, p_format, p_config, p_seed, p_state, coalesce((p_state->>'rulesVersion')::int, 1));
 insert into arena_events(room_id, revision, actor_key, command_id, action, payload, summary) values (p_room, 0, 'host', 'create-' || p_room::text, 'create', '{}'::jsonb, jsonb_build_object('format', p_format));
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'arena_create', jsonb_build_object('format', p_format));
 return jsonb_build_object('ok', true, 'revision', 0);
exception when unique_violation then raise exception 'An Arena Clash match already exists for this room';
end; $$;

-- The way SESSION state changes for a human or host command: revision-locked, idempotent, atomic with every room side effect, award, purchase, new seat and result.
-- p_lease: when a persistent worker holds a live lease, only that owner (or the lease-free control plane before the lease exists) may commit.
create or replace function public.arena_commit(p_room uuid, p_actor text, p_command text, p_expected bigint, p_action text, p_payload jsonb, p_state jsonb,
  p_effects jsonb, p_credits jsonb, p_purchases jsonb, p_results jsonb, p_finished boolean, p_summary jsonb, p_seat jsonb default null, p_lease text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s arena_sessions%rowtype; r rooms%rowtype; v_prev arena_events%rowtype; v_rev bigint; e jsonb; c jsonb; x jsonb; b jsonb; v_n integer; v_pos integer; v_shift interval; v_qid uuid;
begin
 select * into s from arena_sessions where room_id = p_room for update;
 if not found then raise exception 'Arena Clash match not found'; end if;
 select * into v_prev from arena_events where room_id = p_room and actor_key = p_actor and command_id = p_command;
 if found then return jsonb_build_object('ok', true, 'replayed', true, 'revision', v_prev.revision); end if;
 if s.revision <> p_expected then raise exception 'arena_revision_conflict:%', s.revision; end if;
 if s.lease_owner is not null and s.lease_until > now() and s.lease_owner is distinct from p_lease then raise exception 'arena_lease_conflict'; end if;
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
  insert into arena_awards(room_id, credit_key, team_key, amount, submission_ids)
  values (p_room, c->>'key', c->>'teamId', (c->>'amount')::integer, coalesce(array(select jsonb_array_elements_text(c->'submissionIds')), '{}'))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'arena_credit_conflict:%', c->>'key'; end if;
 end loop;
 for b in select * from jsonb_array_elements(coalesce(p_purchases, '[]'::jsonb)) loop
  insert into arena_purchases(room_id, cycle, team_key, helper, cost, player_id)
  values (p_room, (b->>'cycle')::integer, b->>'teamId', b->>'helper', (b->>'cost')::integer, nullif(b->>'seatId', '')::uuid)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'arena_purchase_conflict:%', b->>'teamId'; end if;
 end loop;
 if p_seat is not null then
  insert into arena_seats(room_id, player_id) values (p_room, (p_seat->>'playerId')::uuid) on conflict do nothing;
 end if;
 for x in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
  insert into arena_results(room_id, team_key, team_name, rank, tied, finish_reason, score, quiz, objective, points_spent, players, summary)
  values (p_room, x->>'teamKey', left(x->>'teamName', 40), (x->>'rank')::int, coalesce((x->>'tied')::boolean, false), left(coalesce(x->>'finishReason', 'completed'), 20), (x->>'score')::int, (x->>'quiz')::int,
    (x->>'objective')::int, (x->>'pointsSpent')::int, (x->>'players')::int, coalesce(x->'summary', '{}'::jsonb));
 end loop;
 v_rev := s.revision + 1;
 update arena_sessions set state = p_state, revision = v_rev, status = case when p_finished then 'finished' else 'active' end,
   finished_at = case when p_finished then now() else finished_at end, updated_at = now() where room_id = p_room;
 insert into arena_events(room_id, revision, actor_key, command_id, action, payload, summary)
 values (p_room, v_rev, p_actor, p_command, left(p_action, 40), coalesce(p_payload, '{}'::jsonb), coalesce(p_summary, '{}'::jsonb));
 insert into arena_outbox(room_id, revision, category) values (p_room, v_rev, left(p_action, 40));
 if p_actor = 'host' and p_action ~ '^host:(kick|end|pause|resume|lock|skip|extend|move_seat)' then
  insert into audit_log(room_id, actor_id, action, detail) values (p_room, s.host_id, 'arena_' || replace(p_action, 'host:', ''), coalesce(p_payload, '{}'::jsonb));
 end if;
 return jsonb_build_object('ok', true, 'replayed', false, 'revision', v_rev);
end; $$;

-- The 10 Hz world step: a lean revision-locked write with NO event row (the world is a pure function of the committed state and the intents). Returns the new revision.
create or replace function public.arena_tick(p_room uuid, p_expected bigint, p_state jsonb, p_lease text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s arena_sessions%rowtype; v_rev bigint;
begin
 select * into s from arena_sessions where room_id = p_room for update;
 if not found then raise exception 'Arena Clash match not found'; end if;
 if s.revision <> p_expected then raise exception 'arena_revision_conflict:%', s.revision; end if;
 if s.lease_owner is not null and s.lease_until > now() and s.lease_owner is distinct from p_lease then raise exception 'arena_lease_conflict'; end if;
 if s.status = 'finished' then raise exception 'This match is finished'; end if;
 if p_state is null or jsonb_typeof(p_state) <> 'object' or not (p_state ? 'phase') then raise exception 'Invalid state'; end if;
 v_rev := s.revision + 1;
 update arena_sessions set state = p_state, revision = v_rev, updated_at = now() where room_id = p_room;
 return jsonb_build_object('ok', true, 'revision', v_rev);
end; $$;

-- One student's steering: idempotent by strictly increasing sequence number, CAS on the seat's own revision. Never touches the session row (no cross-seat contention).
create or replace function public.arena_input(p_room uuid, p_seat uuid, p_seq bigint, p_intents jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q arena_seats%rowtype; st text;
begin
 select * into q from arena_seats where room_id = p_room and player_id = p_seat for update;
 if not found then raise exception 'arena_no_seat'; end if;
 if p_seq <= q.last_seq then return jsonb_build_object('ok', true, 'replayed', true, 'seq', q.last_seq); end if;
 select status into st from arena_sessions where room_id = p_room;
 if st is null then raise exception 'Arena Clash match not found'; end if;
 if st = 'finished' then raise exception 'This match is finished'; end if;
 update arena_seats set intents = p_intents, last_seq = p_seq, revision = q.revision + 1, last_input_at = now(), last_seen_at = now() where room_id = p_room and player_id = p_seat;
 return jsonb_build_object('ok', true, 'replayed', false, 'seq', p_seq);
end; $$;

-- Presence and host heartbeat, throttled to at most one write per player every 8 s.
create or replace function public.arena_touch(p_room uuid, p_player uuid, p_host boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
 if p_host then
  update arena_sessions set host_seen_at = now() where room_id = p_room and (host_seen_at is null or host_seen_at < now() - interval '8 seconds');
 elsif p_player is not null then
  update arena_seats set last_seen_at = now() where room_id = p_room and player_id = p_player and last_seen_at < now() - interval '8 seconds';
 end if;
end; $$;

-- A revocable, read-only projector link (only its SHA-256 is stored).
create or replace function public.arena_set_spectator(p_room uuid, p_host uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
 update arena_sessions set spectator_hash = p_hash where room_id = p_room and host_id = p_host;
 if not found then raise exception 'Only the room host can perform this action'; end if;
 return jsonb_build_object('ok', true);
end; $$;

-- Fenced single-owner lease for an optional persistent realtime worker. Each acquisition bumps the epoch; a stale owner's checkpoint is refused.
create or replace function public.arena_acquire_lease(p_room uuid, p_owner text, p_ttl_seconds integer default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s arena_sessions%rowtype; v_epoch bigint;
begin
 if p_owner is null or char_length(p_owner) < 8 then raise exception 'Invalid lease owner'; end if;
 select * into s from arena_sessions where room_id = p_room for update;
 if not found then raise exception 'Arena Clash match not found'; end if;
 if s.lease_owner is not null and s.lease_owner <> p_owner and s.lease_until > now() then raise exception 'arena_lease_conflict'; end if;
 v_epoch := case when s.lease_owner = p_owner and s.lease_until > now() then s.lease_epoch else s.lease_epoch + 1 end;
 update arena_sessions set lease_owner = p_owner, lease_epoch = v_epoch, lease_until = now() + make_interval(secs => greatest(5, least(120, p_ttl_seconds))) where room_id = p_room;
 return jsonb_build_object('ok', true, 'epoch', v_epoch, 'revision', s.revision);
end; $$;
create or replace function public.arena_save_checkpoint(p_room uuid, p_owner text, p_epoch bigint, p_expected bigint, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s arena_sessions%rowtype; v_rev bigint;
begin
 select * into s from arena_sessions where room_id = p_room for update;
 if not found then raise exception 'Arena Clash match not found'; end if;
 if s.lease_owner is distinct from p_owner or s.lease_epoch <> p_epoch or s.lease_until <= now() then raise exception 'arena_lease_conflict'; end if;
 if s.revision <> p_expected then raise exception 'arena_revision_conflict:%', s.revision; end if;
 v_rev := s.revision + 1;
 update arena_sessions set state = p_state, revision = v_rev, updated_at = now(), lease_until = now() + interval '30 seconds' where room_id = p_room;
 return jsonb_build_object('ok', true, 'revision', v_rev);
end; $$;

revoke all on function public.arena_create_session(uuid,uuid,text,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.arena_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.arena_tick(uuid,bigint,jsonb,text) from public, anon, authenticated;
revoke all on function public.arena_input(uuid,uuid,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.arena_touch(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.arena_set_spectator(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.arena_acquire_lease(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.arena_save_checkpoint(uuid,text,bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.arena_results_immutable() from public, anon, authenticated;
grant execute on function public.arena_create_session(uuid,uuid,text,jsonb,text,jsonb) to service_role;
grant execute on function public.arena_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb,text) to service_role;
grant execute on function public.arena_tick(uuid,bigint,jsonb,text) to service_role;
grant execute on function public.arena_input(uuid,uuid,bigint,jsonb) to service_role;
grant execute on function public.arena_touch(uuid,uuid,boolean) to service_role;
grant execute on function public.arena_set_spectator(uuid,uuid,text) to service_role;
grant execute on function public.arena_acquire_lease(uuid,text,integer) to service_role;
grant execute on function public.arena_save_checkpoint(uuid,text,bigint,bigint,jsonb) to service_role;
