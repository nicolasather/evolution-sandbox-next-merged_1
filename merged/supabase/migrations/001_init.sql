-- New, separate educational quiz platform. Run in a NEW Supabase project.
create extension if not exists pgcrypto;

create table public.quizzes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 160), description text not null default '',
 status text not null default 'draft' check (status in ('draft','published')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index quizzes_owner on public.quizzes(owner_id, updated_at desc);
create index quizzes_published on public.quizzes(updated_at desc) where status='published';

create table public.quiz_questions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 position integer not null check(position>=0), kind text not null check(kind in ('multiple_choice','answer_forge','connection_rush','truth_hunt','fill_table')),
 prompt text not null, payload jsonb not null, answer_key jsonb not null,
 base_points integer not null default 100 check (base_points between 0 and 10000),
 unique(quiz_id,position)
);

create table public.rooms (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id),
 host_id uuid not null references auth.users(id), join_code varchar(8) not null unique,
 mode text not null check(mode in ('solo','classroom','online')),
 flow text not null check(flow in ('synchronized','round_robin','independent')),
 status text not null default 'waiting' check(status in ('waiting','active','ended')),
 config jsonb not null default '{}'::jsonb,
 current_index integer not null default 0, turn_index integer not null default 0,
 round_opened_at timestamptz, started_at timestamptz, expires_at timestamptz,
 paused_at timestamptz, revealed boolean not null default false,
 steal_target_id uuid, steal_active boolean not null default false,
 created_at timestamptz not null default now(),
 check ((mode='classroom' and flow in ('synchronized','round_robin')) or (mode='online' and flow in ('synchronized','independent')) or (mode='solo' and flow='independent'))
);
create index rooms_host on public.rooms(host_id,created_at desc);

create table public.room_questions (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 position integer not null, kind text not null, prompt text not null, payload jsonb not null,
 answer_key jsonb not null, base_points integer not null,
 unique(room_id,position)
);
create table public.teams (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 display_name text not null, order_index integer not null, points bigint not null default 0 check(points>=0),
 unique(room_id,order_index)
);
create table public.players (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 display_name text not null, secret_hash text not null unique,
 points bigint not null default 0 check(points>=0), cursor_index integer not null default 0,
 question_opened_at timestamptz, joined_at timestamptz not null default now()
);
create index players_room on public.players(room_id);
create table public.submissions (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 room_question_id uuid not null references public.room_questions(id) on delete cascade,
 actor_type text not null check(actor_type in ('player','team')), actor_id uuid not null,
 response jsonb not null, correct boolean not null,
 base_awarded integer not null default 0, wager integer not null default 0,
 manual_override boolean not null default false, submitted_at timestamptz not null default now(),
 unique(room_question_id,actor_type,actor_id)
);
create index submissions_room_question on public.submissions(room_question_id);
create table public.score_events (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 group_id uuid not null, actor_type text not null check(actor_type in ('player','team')), actor_id uuid not null,
 delta bigint not null, reason text not null, meta jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), undone_at timestamptz
);
create index score_events_order on public.score_events(room_id,created_at desc);

-- Deny ALL direct table access by anon/authenticated clients; only secure server routes with service role read/write.
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.rooms enable row level security;
alter table public.room_questions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.submissions enable row level security;
alter table public.score_events enable row level security;
-- RLS without policies intentionally denies normal clients. Backend checks ownership, visibility, and session tokens.
revoke all on public.quizzes,public.quiz_questions,public.rooms,public.room_questions,public.teams,public.players,public.submissions,public.score_events from anon,authenticated;

-- Save the whole quiz atomically; server route verifies auth user and question schema first.
create or replace function public.save_owned_quiz(p_owner uuid,p_quiz uuid,p_title text,p_description text,p_status text,p_questions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_q jsonb; v_i integer := 0;
begin
 if p_status not in ('draft','published') or trim(p_title) = '' or length(p_title)>160 then raise exception 'Invalid quiz details'; end if;
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)>200 then raise exception 'Invalid question array'; end if;
 if p_status='published' and jsonb_array_length(p_questions)=0 then raise exception 'Published quiz needs questions'; end if;
 if p_quiz is null then
  insert into quizzes(owner_id,title,description,status) values(p_owner,p_title,p_description,p_status) returning id into v_id;
 else
  update quizzes set title=p_title,description=p_description,status=p_status,updated_at=now()
  where id=p_quiz and owner_id=p_owner returning id into v_id;
  if v_id is null then raise exception 'Quiz not found or not owned'; end if;
  delete from quiz_questions where quiz_id=v_id;
 end if;
 for v_q in select value from jsonb_array_elements(p_questions) loop
  insert into quiz_questions(quiz_id,position,kind,prompt,payload,answer_key,base_points)
  values (v_id,v_i,v_q->>'kind',v_q->>'prompt',v_q->'payload',v_q->'answerKey', (v_q->>'basePoints')::integer);
  v_i:=v_i+1;
 end loop;
 return v_id;
end; $$;

-- This is the atomic fifth verification step. The Next.js service already performed steps 1-4.
-- Re-check critical round/slot/dedup conditions *inside* the transaction, under a room row lock.
create or replace function public.commit_answer(
 p_room uuid,p_question uuid,p_actor_type text,p_actor uuid,p_response jsonb,
 p_correct boolean,p_base_award integer,p_wager integer,p_manual boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; q room_questions%rowtype; v_cursor integer; v_opened timestamptz;
 v_balance bigint; v_delta bigint; v_group uuid:=gen_random_uuid(); v_team_order integer;
 v_count integer; v_limit integer; v_deadline integer; v_duration integer;
begin
 select * into r from rooms where id=p_room for update;
 if not found or r.status<>'active' or r.paused_at is not null then raise exception 'Room not active'; end if;
 if r.expires_at is not null and now()>r.expires_at then raise exception 'Match expired'; end if;
 select * into q from room_questions where id=p_question and room_id=p_room;
 if not found then raise exception 'Invalid question'; end if;
 if p_actor_type not in ('team','player') or (r.mode='classroom')<>(p_actor_type='team') then raise exception 'Wrong actor type'; end if;
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
 if p_base_award<0 or p_base_award>q.base_points or (not p_correct and p_base_award<>0) then raise exception 'Invalid award'; end if;
 v_delta:=p_base_award + case when p_wager=0 then 0 when p_correct then p_wager else -p_wager end;
 insert into submissions(room_id,room_question_id,actor_type,actor_id,response,correct,base_awarded,wager,manual_override)
 values(p_room,q.id,p_actor_type,p_actor,p_response,p_correct,p_base_award,p_wager,p_manual);
 if p_actor_type='team' then update teams set points=points+v_delta where id=p_actor;
 else
  update players set points=points+v_delta,
    cursor_index=case when r.flow='independent' then cursor_index+1 else cursor_index end,
    question_opened_at=case when r.flow='independent' then now() else question_opened_at end
  where id=p_actor;
 end if;
 if v_delta<>0 then
  insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason)
  values(p_room,v_group,p_actor_type,p_actor,v_delta,'answer');
 end if;
 if r.steal_active and r.steal_target_id=p_actor then update rooms set steal_active=false,steal_target_id=null where id=p_room; end if;
 return jsonb_build_object('correct',p_correct,'awarded',v_delta,'newPoints',v_balance+v_delta);
end; $$;

-- Host-triggered events: all point changes happen within one locked database transaction.
create or replace function public.apply_modifier(p_room uuid,p_kind text,p_target uuid,p_other uuid default null,p_amount integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r rooms%rowtype; v_type text; v_a bigint;v_b bigint;v_delta bigint;v_group uuid:=gen_random_uuid();v_max bigint;v_cap bigint;v_actual bigint;
begin
 select * into r from rooms where id=p_room for update;
 if not found or r.status<>'active' or r.paused_at is not null then raise exception 'Room not active'; end if;
 if not ((r.config->'modifiers') ? p_kind) then raise exception 'Modifier not selected'; end if;
 if p_kind not in ('lose_all','go_to_first','steal_points','give_points','swap_points','potluck') then raise exception 'Modifier is not an instant point event'; end if;
 v_type:=case when r.mode='classroom' then 'team' else 'player' end;
 if v_type='team' then select points into v_a from teams where id=p_target and room_id=p_room for update;
 else select points into v_a from players where id=p_target and room_id=p_room for update; end if;
 if not found then raise exception 'Target absent'; end if;
 if p_kind in ('steal_points','give_points','swap_points') then
  if p_other is null or p_other=p_target then raise exception 'Distinct opponent required'; end if;
  if v_type='team' then select points into v_b from teams where id=p_other and room_id=p_room for update;
  else select points into v_b from players where id=p_other and room_id=p_room for update; end if;
  if not found then raise exception 'Opponent absent'; end if;
 end if;
 if p_kind in ('steal_points','give_points') and (p_amount<1 or p_amount>10000) then raise exception 'Invalid transfer amount'; end if;
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
 insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason)
 values(p_room,v_group,v_type,p_target,v_delta,p_kind);
 if p_kind in ('steal_points','give_points','swap_points') then
  if v_type='team' then update teams set points=points-v_delta where id=p_other;
  else update players set points=points-v_delta where id=p_other; end if;
  insert into score_events(room_id,group_id,actor_type,actor_id,delta,reason)
  values(p_room,v_group,v_type,p_other,-v_delta,p_kind);
 end if;
 return jsonb_build_object('modifier',p_kind,'change',v_delta,'groupId',v_group);
end; $$;

-- Undo most recent event GROUP only. Undo is refused if points have already been spent in a way that would cause negative balance.
create or replace function public.undo_latest_score_event(p_room uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r rooms%rowtype;v_group uuid;ev record;v_current bigint;
begin
 select * into r from rooms where id=p_room for update;
 if not found then raise exception 'Room absent'; end if;
 select group_id into v_group from score_events where room_id=p_room and undone_at is null order by created_at desc,id desc limit 1;
 if v_group is null then raise exception 'Nothing to undo'; end if;
 for ev in select * from score_events where room_id=p_room and group_id=v_group and undone_at is null order by id loop
  if ev.actor_type='team' then select points into v_current from teams where id=ev.actor_id for update;
  else select points into v_current from players where id=ev.actor_id for update; end if;
  if v_current-ev.delta<0 then raise exception 'Cannot undo: points already spent or transferred'; end if;
 end loop;
 for ev in select * from score_events where room_id=p_room and group_id=v_group and undone_at is null loop
  if ev.actor_type='team' then update teams set points=points-ev.delta where id=ev.actor_id;
  else update players set points=points-ev.delta where id=ev.actor_id; end if;
 end loop;
 update score_events set undone_at=now() where room_id=p_room and group_id=v_group;
 return jsonb_build_object('undoneGroup',v_group);
end; $$;

-- RPC execute limited to trusted service role: no client may submit arbitrary grading or award scores.
revoke all on function public.save_owned_quiz(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.commit_answer(uuid,uuid,text,uuid,jsonb,boolean,integer,integer,boolean) from public,anon,authenticated;
revoke all on function public.apply_modifier(uuid,text,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.undo_latest_score_event(uuid) from public,anon,authenticated;
grant execute on function public.save_owned_quiz(uuid,uuid,text,text,text,jsonb) to service_role;
grant execute on function public.commit_answer(uuid,uuid,text,uuid,jsonb,boolean,integer,integer,boolean) to service_role;
grant execute on function public.apply_modifier(uuid,text,uuid,uuid,integer) to service_role;
grant execute on function public.undo_latest_score_event(uuid) to service_role;
