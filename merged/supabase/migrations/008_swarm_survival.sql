-- 008_swarm_survival.sql — ADDITIVE and reversible (see 008_swarm_survival_down.sql).
-- Swarm Survival: a real-time online game run by a persistent authoritative worker (swarm-server/). The worker connects with a service-role
-- Postgres connection. Existing tables are only referenced (rooms), never altered. Every new table has RLS enabled with NO policies and no
-- anon/authenticated grants. Exactly-once effects are guaranteed by PRIMARY KEYS, not by application code:
--   swarm_answers  (room, window, participant)  one graded answer per participant per question window
--   swarm_credits  (room, window, team)         one point award per team per window
--   swarm_purchases(room, draft, team)          one upgrade purchase per team per draft
--   swarm_audit    (room, command_id)           every host command applies once
-- The simulation state itself is a checkpoint (jsonb) written by the single lease-holding worker; it contains no answer keys.

create table if not exists public.swarm_sessions (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 host_id uuid not null,
 mode text not null check (mode in ('coop','versus')),
 config jsonb not null,
 seed bigint not null,
 status text not null default 'active' check (status in ('active','finished','abandoned')),
 engine_version integer not null default 1,
 checkpoint jsonb,
 checkpoint_rev bigint not null default 0 check (checkpoint_rev >= 0),
 worker_id text,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 finished_at timestamptz,
 constraint swarm_checkpoint_size check (checkpoint is null or pg_column_size(checkpoint) <= 3000000),
 constraint swarm_config_shape check (jsonb_typeof(config) = 'object')
);
create index if not exists swarm_sessions_host on public.swarm_sessions(host_id, created_at desc);
create index if not exists swarm_sessions_active on public.swarm_sessions(status, lease_until) where status = 'active';

create table if not exists public.swarm_participants (
 room_id uuid not null references public.rooms(id) on delete cascade,
 participant_id text not null check (participant_id ~ '^[a-f0-9]{24}$'),
 display_name text not null check (char_length(display_name) between 1 and 40),
 name_key text not null check (char_length(name_key) between 1 and 80),
 team_id text not null check (team_id ~ '^t[1-4]$'),
 role text not null check (role in ('guardian','striker','medic','engineer','scout')),
 joined_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key (room_id, participant_id),
 unique (room_id, name_key)
);

create table if not exists public.swarm_answers (
 room_id uuid not null references public.rooms(id) on delete cascade,
 window_id text not null check (window_id ~ '^q[0-9]{1,4}$'),
 participant_id text not null,
 question_id uuid not null,
 response jsonb not null check (pg_column_size(response) <= 4000),
 fraction numeric(5,4) not null check (fraction >= 0 and fraction <= 1),
 correct boolean not null,
 created_at timestamptz not null default now(),
 primary key (room_id, window_id, participant_id)
);

create table if not exists public.swarm_credits (
 room_id uuid not null references public.rooms(id) on delete cascade,
 window_id text not null,
 team_id text not null,
 amount integer not null check (amount >= 0 and amount <= 100),
 eligible integer not null check (eligible between 0 and 5),
 created_at timestamptz not null default now(),
 primary key (room_id, window_id, team_id)
);

create table if not exists public.swarm_purchases (
 room_id uuid not null references public.rooms(id) on delete cascade,
 draft_id text not null,
 team_id text not null,
 upgrade text check (upgrade is null or upgrade in ('fan_bolts','glacier_field','beacon_plate','mend_garden','gear_drone','swift_steps','ricochet','last_stand')),
 cost integer not null check (cost >= 0),
 wallet_before integer not null check (wallet_before >= 0),
 wallet_after integer not null check (wallet_after >= 0 and wallet_after = wallet_before - cost),
 how text not null check (how in ('vote','default','none')),
 created_at timestamptz not null default now(),
 primary key (room_id, draft_id, team_id)
);

create table if not exists public.swarm_audit (
 id bigserial primary key,
 room_id uuid not null references public.rooms(id) on delete cascade,
 command_id text not null check (char_length(command_id) between 1 and 60),
 cmd text not null check (char_length(cmd) between 1 and 30),
 detail text check (detail is null or char_length(detail) <= 300),
 at_ms bigint not null,
 created_at timestamptz not null default now(),
 unique (room_id, command_id)
);

create table if not exists public.swarm_results (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 outcome text not null check (outcome in ('won','lost','ended')),
 reason text not null,
 standings jsonb not null,
 created_at timestamptz not null default now()
);
create or replace function public.swarm_results_immutable() returns trigger language plpgsql as $$
begin raise exception 'swarm_results are immutable' using errcode = '23000'; end $$;
drop trigger if exists swarm_results_no_update on public.swarm_results;
create trigger swarm_results_no_update before update on public.swarm_results for each row execute function public.swarm_results_immutable();

-- Single-writer lease: only one worker may drive a room. Returns true when this worker now holds (or renewed) the lease. ----------------
create or replace function public.swarm_acquire_lease(p_room uuid, p_worker text, p_ttl_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if p_ttl_seconds < 5 or p_ttl_seconds > 600 then raise exception 'bad ttl' using errcode = '22023'; end if;
  update swarm_sessions set worker_id = p_worker, lease_until = now() + make_interval(secs => p_ttl_seconds), updated_at = now()
   where room_id = p_room and status = 'active' and (worker_id is null or worker_id = p_worker or lease_until is null or lease_until < now());
  get diagnostics v_n = row_count; return v_n = 1;
end $$;

-- Create the session for a room the host owns (the room itself is made by the existing create_room flow). ---------------------------------
create or replace function public.swarm_create_session(p_room uuid, p_host uuid, p_config jsonb, p_seed bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if r.host_id <> p_host then raise exception 'not the host of this room' using errcode = '42501'; end if;
  insert into swarm_sessions(room_id, host_id, mode, config, seed) values (p_room, p_host, p_config->>'mode', p_config, p_seed);
end $$;

-- Checkpoint write: fenced by lease holder and monotonic revision (a stale worker can never overwrite a newer state). -------------------------
create or replace function public.swarm_save_checkpoint(p_room uuid, p_worker text, p_rev bigint, p_checkpoint jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update swarm_sessions set checkpoint = p_checkpoint, checkpoint_rev = p_rev, updated_at = now()
   where room_id = p_room and worker_id = p_worker and status = 'active' and lease_until >= now() and checkpoint_rev <= p_rev;
  get diagnostics v_n = row_count; return v_n = 1;
end $$;

alter table public.swarm_sessions enable row level security;
alter table public.swarm_participants enable row level security;
alter table public.swarm_answers enable row level security;
alter table public.swarm_credits enable row level security;
alter table public.swarm_purchases enable row level security;
alter table public.swarm_audit enable row level security;
alter table public.swarm_results enable row level security;
revoke all on public.swarm_sessions, public.swarm_participants, public.swarm_answers, public.swarm_credits, public.swarm_purchases, public.swarm_audit, public.swarm_results from anon, authenticated;
revoke execute on function public.swarm_acquire_lease(uuid,text,integer), public.swarm_create_session(uuid,uuid,jsonb,bigint), public.swarm_save_checkpoint(uuid,text,bigint,jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.swarm_sessions, public.swarm_participants, public.swarm_answers, public.swarm_credits, public.swarm_purchases, public.swarm_audit, public.swarm_results to service_role;
    grant usage on all sequences in schema public to service_role;
    grant execute on function public.swarm_acquire_lease(uuid,text,integer), public.swarm_create_session(uuid,uuid,jsonb,bigint), public.swarm_save_checkpoint(uuid,text,bigint,jsonb) to service_role;
  end if;
end $$;
