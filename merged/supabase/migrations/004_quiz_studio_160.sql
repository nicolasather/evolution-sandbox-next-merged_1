-- 004_quiz_studio_160.sql — ADDITIVE and reversible (see 004_quiz_studio_160_down.sql).
-- Nothing here drops, renames or rewrites an existing column, table or function. v1 functions stay in place so the app works before and after this runs.
-- All new tables have RLS enabled with NO policies and no grants to anon/authenticated: only the server (service_role) touches them.

-- 1. Quiz-level metadata (language, subject, age band, tags, estimated time, remix source, review state) ----------------
alter table public.quizzes add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.quizzes add column if not exists archived_at timestamptz;
alter table public.quizzes add column if not exists review_state text not null default 'unreviewed' check (review_state in ('unreviewed','in_review','approved','removed'));
alter table public.quizzes add column if not exists source_quiz_id uuid references public.quizzes(id) on delete set null;
create index if not exists quizzes_meta_gin on public.quizzes using gin (meta jsonb_path_ops);

-- 2. Player lifecycle: approval, removal, ban (items 089, 131, 132) -------------------------------------------------------
alter table public.players add column if not exists status text not null default 'active' check (status in ('pending','active','removed','banned'));
alter table public.players add column if not exists identity jsonb not null default '{}'::jsonb;   -- equipped icon/frames, public only
alter table public.players add column if not exists privacy_bucket text;                           -- salted daily hash, never a raw IP

-- 3. Revisions (items 050, 058) --------------------------------------------------------------------------------------------
create table if not exists public.quiz_revisions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 label text not null default '', doc jsonb not null, doc_hash text not null,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists quiz_revisions_quiz on public.quiz_revisions(quiz_id, created_at desc);

-- 4. Media assets with ownership and quotas (items 031-040) -----------------------------------------------------------------
create table if not exists public.media_assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 quiz_id uuid references public.quizzes(id) on delete set null, storage_path text not null unique,
 mime text not null, bytes integer not null check (bytes between 1 and 20000000), width integer, height integer,
 alt_text text not null default '', status text not null default 'ready' check (status in ('ready','quarantined','deleted')),
 created_at timestamptz not null default now()
);
create index if not exists media_owner on public.media_assets(owner_id, created_at desc);

-- 5. Reports, moderation, appeals, audit (items 059, 060, 137, 140) -------------------------------------------------------
create table if not exists public.content_reports (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 reporter_id uuid references auth.users(id) on delete set null, reason text not null check (reason in ('incorrect_fact','broken_media','copyright','inappropriate','other')),
 detail text not null default '' check (char_length(detail) <= 1000), status text not null default 'received' check (status in ('received','in_review','resolved','dismissed','appealed')),
 resolution text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists content_reports_status on public.content_reports(status, created_at desc);
create table if not exists public.audit_log (
 id bigserial primary key, room_id uuid references public.rooms(id) on delete cascade, actor_id uuid, action text not null,
 detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists audit_room on public.audit_log(room_id, created_at desc);

-- 6. Cosmetic progress ledger — event-sourced, idempotent, NON-spendable (items 112-120) ---------------------------------
create table if not exists public.cosmetic_events (
 id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, kind text not null,
 payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists cosmetic_events_owner on public.cosmetic_events(owner_id, created_at);
create table if not exists public.cosmetic_profiles (
 owner_id uuid primary key references auth.users(id) on delete cascade, equipped jsonb not null default '{}'::jsonb,
 opted_out boolean not null default false, unlocked jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);

-- 7. Privacy-safe telemetry (items 154, 149) — no names, no free text, no raw IPs ---------------------------------------------
create table if not exists public.quiz_telemetry (
 id bigserial primary key, name text not null check (char_length(name) <= 60), props jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists quiz_telemetry_name on public.quiz_telemetry(name, created_at desc);

alter table public.quiz_revisions enable row level security; alter table public.media_assets enable row level security;
alter table public.content_reports enable row level security; alter table public.audit_log enable row level security;
alter table public.cosmetic_events enable row level security; alter table public.cosmetic_profiles enable row level security;
alter table public.quiz_telemetry enable row level security;
revoke all on public.quiz_revisions, public.media_assets, public.content_reports, public.audit_log, public.cosmetic_events, public.cosmetic_profiles, public.quiz_telemetry from anon, authenticated;
grant select, insert, update, delete on public.quiz_revisions, public.media_assets, public.content_reports, public.audit_log, public.cosmetic_events, public.cosmetic_profiles, public.quiz_telemetry to service_role;
grant usage on all sequences in schema public to service_role;

-- 8. save_owned_quiz_v2: same atomic save plus meta, and an automatic revision on publish ---------------------------------
create or replace function public.save_owned_quiz_v2(p_owner uuid,p_quiz uuid,p_title text,p_description text,p_status text,p_questions jsonb,p_meta jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
 if pg_column_size(p_meta) > 8000 then raise exception 'Quiz details too large'; end if;
 v_id := public.save_owned_quiz(p_owner,p_quiz,p_title,p_description,p_status,p_questions);
 update quizzes set meta = coalesce(p_meta,'{}'::jsonb) where id=v_id;
 if p_status='published' then
  insert into quiz_revisions(quiz_id,label,doc,doc_hash,created_by)
  values (v_id,'Published',jsonb_build_object('title',p_title,'description',p_description,'meta',coalesce(p_meta,'{}'::jsonb),'questions',p_questions), md5(p_questions::text||p_title), p_owner);
  delete from quiz_revisions where quiz_id=v_id and id not in (select id from quiz_revisions where quiz_id=v_id order by created_at desc limit 30);
 end if;
 return v_id;
end; $$;

-- 9. join_room_v2: host approval + ban list + lock-after-start (items 089, 131, 132) ---------------------------------------
create or replace function public.join_room_v2(p_code text, p_name text, p_hash text, p_bucket text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_count integer; v_player uuid; v_status text:='active'; v_access jsonb;
begin
 select * into r from rooms where join_code = upper(p_code) for update;
 if not found or r.mode <> 'online' or r.status = 'ended' then raise exception 'This online room is not joinable'; end if;
 if r.expires_at is not null and now() > r.expires_at then raise exception 'This online room is not joinable'; end if;
 v_access := coalesce(r.config->'access','{}'::jsonb);
 if (v_access->>'lockedAfterStart')::boolean is true and r.status='active' then raise exception 'This room is locked'; end if;
 if p_bucket is not null and exists (select 1 from players where room_id=r.id and status='banned' and privacy_bucket=p_bucket) then raise exception 'This online room is not joinable'; end if;
 select count(*) into v_count from players where room_id = r.id and status in ('active','pending');
 if v_count >= 100 then raise exception 'Room player limit reached'; end if;
 if exists (select 1 from players where room_id = r.id and lower(display_name) = lower(p_name) and status<>'removed') then raise exception 'That display name is already taken in this room'; end if;
 if (v_access->>'requireApproval')::boolean is true then v_status:='pending'; end if;
 insert into players(room_id, display_name, secret_hash, question_opened_at, status, privacy_bucket)
 values (r.id, p_name, p_hash, case when r.status = 'active' then now() end, v_status, p_bucket) returning id into v_player;
 return jsonb_build_object('roomId', r.id, 'playerId', v_player, 'status', v_status);
end; $$;

-- 10. moderate_player: approve / remove / ban, audited (items 089, 131, 132, 139) -------------------------------------------
create or replace function public.moderate_player(p_room uuid, p_host uuid, p_player uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
 select * into r from rooms where id=p_room and host_id=p_host for update;
 if not found then raise exception 'Room not found'; end if;
 if p_action not in ('approve','remove','ban') then raise exception 'Unknown action'; end if;
 update players set status = case p_action when 'approve' then 'active' when 'remove' then 'removed' else 'banned' end where id=p_player and room_id=p_room;
 if not found then raise exception 'Player not found'; end if;
 insert into audit_log(room_id,actor_id,action,detail) values (p_room,p_host,'player_'||p_action,jsonb_build_object('player',p_player));
 return jsonb_build_object('ok',true);
end; $$;

-- 11. adjust_points: audited manual correction with a mandatory reason (item 084) ----------------------------------------
create or replace function public.adjust_points(p_room uuid, p_host uuid, p_actor_type text, p_actor uuid, p_delta integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_balance bigint;
begin
 if p_delta=0 or abs(p_delta)>10000 then raise exception 'Invalid adjustment'; end if;
 if char_length(trim(coalesce(p_reason,'')))<3 or char_length(p_reason)>200 then raise exception 'A reason is required'; end if;
 select * into r from rooms where id=p_room and host_id=p_host for update;
 if not found then raise exception 'Room not found'; end if;
 if p_actor_type='team' then select points into v_balance from teams where id=p_actor and room_id=p_room for update;
 else select points into v_balance from players where id=p_actor and room_id=p_room for update; end if;
 if not found then raise exception 'Participant not found'; end if;
 if v_balance + p_delta < 0 then p_delta := -v_balance::integer; end if;
 if p_actor_type='team' then update teams set points=points+p_delta where id=p_actor; else update players set points=points+p_delta where id=p_actor; end if;
 insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason,meta) values (p_room,gen_random_uuid(),p_actor_type,p_actor,p_delta,'manual_correction',jsonb_build_object('why',p_reason));
 insert into audit_log(room_id,actor_id,action,detail) values (p_room,p_host,'adjust_points',jsonb_build_object('actor',p_actor,'delta',p_delta,'why',p_reason));
 return jsonb_build_object('newPoints',v_balance+p_delta);
end; $$;

-- 12. commit_answer_v2: partial credit and speed bonus, validated inside the locked transaction ----------------------------
create or replace function public.commit_answer_v2(
 p_room uuid,p_question uuid,p_actor_type text,p_actor uuid,p_response jsonb,
 p_correct boolean,p_base_award integer,p_bonus integer,p_partial boolean,p_wager integer,p_manual boolean
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
  if exists(select 1 from players where id=p_actor and status<>'active') then raise exception 'Player not active'; end if;
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
 -- v2 award rules: base never exceeds the question's points; partial credit only when the question allows it; a speed bonus only on a fully correct answer and never above the base.
 if p_base_award<0 or p_base_award>q.base_points or p_bonus<0 or p_bonus>q.base_points then raise exception 'Invalid award'; end if;
 if p_correct and p_base_award<>q.base_points and not p_partial then raise exception 'Invalid award'; end if;
 if not p_correct and p_base_award<>0 and not p_partial then raise exception 'Invalid award'; end if;
 if p_bonus>0 and not (p_correct and p_base_award=q.base_points) then raise exception 'Invalid award'; end if;
 v_delta:=p_base_award + p_bonus + case when p_wager=0 then 0 when p_correct then p_wager else -p_wager end;
 insert into submissions(room_id,room_question_id,actor_type,actor_id,response,correct,base_awarded,wager,manual_override)
 values(p_room,q.id,p_actor_type,p_actor,p_response,p_correct,p_base_award+p_bonus,p_wager,p_manual);
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
  values(p_room,v_group,p_actor_type,p_actor,v_delta,'answer',jsonb_build_object('pos',q.position,'bonus',p_bonus,'partial',p_partial));
 end if;
 if r.steal_active and r.steal_target_id=p_actor then update rooms set steal_active=false,steal_target_id=null where id=p_room; end if;
 if v_finished and r.mode='solo' then update rooms set status='ended',revealed=true where id=p_room; end if;
 return jsonb_build_object('correct',p_correct,'awarded',v_delta,'newPoints',v_balance+v_delta,'finished',v_finished);
end; $$;

-- 12b. control_room_v2: every v1 action plus skip / replay-prompt / cancel, all written to the audit log (items 085, 090) ------
create or replace function public.control_room_v2(p_room uuid, p_host uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_out jsonb;
begin
 select * into r from rooms where id = p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.host_id is distinct from p_host or p_host is null then raise exception 'Only the room host can perform this action'; end if;
 if p_action in ('start','next','pause','resume','reveal','end') then
  v_out := public.control_room(p_room, p_host, p_action);
 elsif p_action = 'skip' then
  v_out := public.control_room(p_room, p_host, 'next');
 elsif p_action = 'replay' then
  if r.status <> 'active' or r.paused_at is not null then raise exception 'Cannot replay the prompt now'; end if;
  if r.flow = 'independent' then raise exception 'Independent rooms have no shared prompt to replay'; end if;
  update rooms set round_opened_at = now(), revealed = false where id = p_room;
  v_out := jsonb_build_object('ok', true);
 elsif p_action = 'cancel' then
  if r.status = 'ended' then raise exception 'Room already ended'; end if;
  update rooms set status = 'ended', revealed = true, paused_at = null, steal_active = false, steal_target_id = null, config = config || '{"cancelled":true}'::jsonb where id = p_room;
  v_out := jsonb_build_object('ok', true);
 else
  raise exception 'Unsupported control action';
 end if;
 insert into audit_log(room_id, actor_id, action, detail) values (p_room, p_host, 'control_' || p_action, jsonb_build_object('index', r.current_index));
 return v_out;
end; $$;

-- 13. Retention: extends the existing cleanup without changing it (items 135, 136) ----------------------------------------
create or replace function public.cleanup_quiz_studio_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a integer; b integer; c integer;
begin
 delete from quiz_telemetry where created_at < now() - interval '30 days'; get diagnostics a = row_count;
 delete from audit_log where created_at < now() - interval '90 days'; get diagnostics b = row_count;
 update media_assets set status='deleted' where status='ready' and quiz_id is null and created_at < now() - interval '7 days'; get diagnostics c = row_count;
 return jsonb_build_object('telemetry',a,'audit',b,'orphanMedia',c);
end; $$;
