-- 007_tower_defense.sql — ADDITIVE and reversible (see 007_tower_defense_down.sql).
-- Tower Defense: an online, individual-device game on top of the existing rooms / players / room_questions / submissions.
-- Nothing existing is dropped, renamed or rewritten; projector_sessions (and its 006 allow-list) is untouched — Tower Defense has its own tables.
-- Every new table has RLS enabled with NO policies and no anon/authenticated grants: only the server (service_role) reads or writes them,
-- and every write goes through a SECURITY DEFINER function with `set search_path = public` that re-checks ownership under row locks.

-- 1. One match per room. `state` is the pure engine's JSON (no seed, no answer keys); `seed` is a separate private column. ---------------
create table if not exists public.td_sessions (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 host_id uuid not null references auth.users(id) on delete cascade,
 format text not null check (format in ('coop','versus')),
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
 constraint td_state_size check (pg_column_size(state) <= 400000),
 constraint td_state_shape check (jsonb_typeof(state) = 'object' and state ? 'phase' and state ? 'teams' and (state->>'rulesVersion')::int = rules_version)
);
create index if not exists td_sessions_host on public.td_sessions(host_id, created_at desc);
create index if not exists td_sessions_active on public.td_sessions(status) where status = 'active';

-- 2. Append-only action ledger. (room, actor, command) makes every command idempotent; (room, revision) orders them. -------------------------
create table if not exists public.td_events (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 revision bigint not null,
 actor_key text not null check (char_length(actor_key) between 1 and 80),
 command_id text not null check (char_length(command_id) between 8 and 80),
 action text not null check (action ~ '^[a-z_:]{2,40}$'),
 payload jsonb not null default '{}'::jsonb,
 summary jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique (room_id, actor_key, command_id),
 unique (room_id, revision)
);
create index if not exists td_events_room on public.td_events(room_id, revision);

-- 3. Exactly-once credit of answers into squad points. A synchronized question credits each squad once (key q:<question>:<squad>);
--    an independent answer credits once per submission (key s:<submission>). The primary key is the guarantee. --------------------------
create table if not exists public.td_credits (
 room_id uuid not null references public.rooms(id) on delete cascade,
 credit_key text not null check (char_length(credit_key) between 3 and 140),
 team_key text not null check (char_length(team_key) between 1 and 40),
 amount integer not null check (amount >= 0 and amount <= 100000),
 submission_ids text[] not null default '{}',
 created_at timestamptz not null default now(),
 primary key (room_id, credit_key)
);

-- 4. Presence (who is connected when a question opens), throttled writes. ------------------------------------------------------------
create table if not exists public.td_presence (
 room_id uuid not null references public.rooms(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 seen_at timestamptz not null default now(),
 primary key (room_id, player_id)
);

-- 5. Final results: one row per squad, written once in the commit that finishes the match, never updated. -----------------------------
create table if not exists public.td_results (
 room_id uuid not null references public.rooms(id) on delete cascade,
 team_key text not null check (char_length(team_key) between 1 and 40),
 team_name text not null,
 rank integer not null check (rank >= 1),
 outcome text not null check (char_length(outcome) <= 20),
 waves_cleared integer not null check (waves_cleared >= 0),
 core_hp integer not null check (core_hp >= 0),
 core_max integer not null check (core_max >= 1),
 accuracy_pct integer check (accuracy_pct is null or accuracy_pct between 0 and 100),
 answered integer not null check (answered >= 0),
 points integer not null check (points >= 0),
 earned integer not null check (earned >= 0),
 spent integer not null check (spent >= 0),
 report jsonb not null default '{}'::jsonb,
 finalized_at timestamptz not null default now(),
 primary key (room_id, team_key)
);
create or replace function public.td_results_immutable() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Tower Defense results are final'; end; $$;
drop trigger if exists td_results_no_update on public.td_results;
create trigger td_results_no_update before update on public.td_results for each row execute function public.td_results_immutable();

-- 6. Outbox: one row per committed revision, for the realtime notifier (clients always re-read the authoritative state). ----------------
create table if not exists public.td_outbox (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 revision bigint not null,
 category text not null check (char_length(category) <= 40),
 created_at timestamptz not null default now(),
 published_at timestamptz
);
create index if not exists td_outbox_room on public.td_outbox(room_id, id);

alter table public.td_sessions enable row level security;
alter table public.td_events enable row level security;
alter table public.td_credits enable row level security;
alter table public.td_presence enable row level security;
alter table public.td_results enable row level security;
alter table public.td_outbox enable row level security;
revoke all on public.td_sessions, public.td_events, public.td_credits, public.td_presence, public.td_results, public.td_outbox from anon, authenticated;
grant select, insert, update, delete on public.td_sessions, public.td_events, public.td_credits, public.td_presence, public.td_results, public.td_outbox to service_role;
grant usage on all sequences in schema public to service_role;

-- 7. Create the match (host only, online room, before it starts). ----------------------------------------------------------------------
create or replace function public.td_create_session(p_room uuid, p_host uuid, p_format text, p_config jsonb, p_seed text, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if r.mode <> 'online' then raise exception 'Tower Defense runs in online rooms'; end if;
 if r.status <> 'waiting' then raise exception 'The game has already started'; end if;
 if not (r.config ? 'td') then raise exception 'This room was not created for Tower Defense'; end if;
 insert into td_sessions(room_id, host_id, format, config, seed, state, rules_version) values (p_room, p_host, p_format, p_config, p_seed, p_state, coalesce((p_state->>'rulesVersion')::int, 1));
 insert into td_events(room_id, revision, actor_key, command_id, action, payload, summary) values (p_room, 0, 'host', 'create-' || p_room::text, 'create', '{}'::jsonb, jsonb_build_object('format', p_format));
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'td_create', jsonb_build_object('format', p_format));
 return jsonb_build_object('ok', true, 'revision', 0);
exception when unique_violation then raise exception 'A Tower Defense match already exists for this room';
end; $$;

-- 8. The ONE way state changes: revision-locked, idempotent, and atomic with every room side effect, credit and final result. -------------
-- p_effects: [{type:'start'|'open'(position)|'reveal'|'pause'|'resume'|'end'|'kick'(seat)}], p_credits: [{key,teamId,amount,submissionIds}],
-- p_results: [{teamKey,teamName,rank,outcome,wavesCleared,coreHP,coreMax,accuracyPct,answered,points,earned,spent,report}]
create or replace function public.td_commit(p_room uuid, p_actor text, p_command text, p_expected bigint, p_action text, p_payload jsonb, p_state jsonb,
  p_effects jsonb, p_credits jsonb, p_results jsonb, p_finished boolean, p_summary jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s td_sessions%rowtype; r rooms%rowtype; v_prev td_events%rowtype; v_rev bigint; e jsonb; c jsonb; x jsonb; v_n integer; v_pos integer; v_shift interval; v_qid uuid;
begin
 select * into s from td_sessions where room_id = p_room for update;
 if not found then raise exception 'Tower Defense match not found'; end if;
 select * into v_prev from td_events where room_id = p_room and actor_key = p_actor and command_id = p_command;
 if found then return jsonb_build_object('ok', true, 'replayed', true, 'revision', v_prev.revision); end if;
 if s.revision <> p_expected then raise exception 'td_revision_conflict:%', s.revision; end if;
 if s.status = 'finished' then raise exception 'This match is finished'; end if;
 if p_state is null or jsonb_typeof(p_state) <> 'object' or not (p_state ? 'phase') then raise exception 'Invalid state'; end if;
 select * into r from rooms where id = p_room for update;
 -- room side effects, in order, inside this transaction
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
 -- exactly-once credits: a key that already exists aborts the whole commit (the caller reloads and never pays twice)
 for c in select * from jsonb_array_elements(coalesce(p_credits, '[]'::jsonb)) loop
  insert into td_credits(room_id, credit_key, team_key, amount, submission_ids)
  values (p_room, c->>'key', c->>'teamId', (c->>'amount')::integer, coalesce(array(select jsonb_array_elements_text(c->'submissionIds')), '{}'))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'td_credit_conflict:%', c->>'key'; end if;
 end loop;
 for x in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
  insert into td_results(room_id, team_key, team_name, rank, outcome, waves_cleared, core_hp, core_max, accuracy_pct, answered, points, earned, spent, report)
  values (p_room, x->>'teamKey', left(x->>'teamName', 40), (x->>'rank')::int, x->>'outcome', (x->>'wavesCleared')::int, (x->>'coreHP')::int, (x->>'coreMax')::int,
    nullif(x->>'accuracyPct','')::int, (x->>'answered')::int, (x->>'points')::int, (x->>'earned')::int, (x->>'spent')::int, coalesce(x->'report', '{}'::jsonb));
 end loop;
 v_rev := s.revision + 1;
 update td_sessions set state = p_state, revision = v_rev, status = case when p_finished then 'finished' else 'active' end,
   finished_at = case when p_finished then now() else finished_at end, updated_at = now() where room_id = p_room;
 insert into td_events(room_id, revision, actor_key, command_id, action, payload, summary)
 values (p_room, v_rev, p_actor, p_command, left(p_action, 40), coalesce(p_payload, '{}'::jsonb), coalesce(p_summary, '{}'::jsonb));
 insert into td_outbox(room_id, revision, category) values (p_room, v_rev, left(p_action, 40));
 if p_actor = 'host' and p_action ~ '^host:(kick|end|pause|resume|lock|move_seat)' then
  insert into audit_log(room_id, actor_id, action, detail) values (p_room, s.host_id, 'td_' || replace(p_action, 'host:', ''), coalesce(p_payload, '{}'::jsonb));
 end if;
 return jsonb_build_object('ok', true, 'replayed', false, 'revision', v_rev);
end; $$;

-- 9. Presence and host heartbeat, throttled to at most one write per player every 8 s. ------------------------------------------------
create or replace function public.td_touch(p_room uuid, p_player uuid, p_host boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
 if p_host then
  update td_sessions set host_seen_at = now() where room_id = p_room and (host_seen_at is null or host_seen_at < now() - interval '8 seconds');
 elsif p_player is not null then
  insert into td_presence(room_id, player_id, seen_at) values (p_room, p_player, now())
  on conflict (room_id, player_id) do update set seen_at = now() where td_presence.seen_at < now() - interval '8 seconds';
 end if;
end; $$;

-- 10. A revocable, read-only projector link (only its SHA-256 is stored). -------------------------------------------------------------
create or replace function public.td_set_spectator(p_room uuid, p_host uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
 update td_sessions set spectator_hash = p_hash where room_id = p_room and host_id = p_host;
 if not found then raise exception 'Only the room host can perform this action'; end if;
 return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.td_create_session(uuid,uuid,text,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.td_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.td_touch(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.td_set_spectator(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.td_results_immutable() from public, anon, authenticated;
grant execute on function public.td_create_session(uuid,uuid,text,jsonb,text,jsonb) to service_role;
grant execute on function public.td_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb) to service_role;
grant execute on function public.td_touch(uuid,uuid,boolean) to service_role;
grant execute on function public.td_set_spectator(uuid,uuid,text) to service_role;
