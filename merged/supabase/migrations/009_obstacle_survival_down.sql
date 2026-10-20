-- 009_obstacle_survival_down.sql — removes ONLY the Obstacle Survival objects added by 009. Rooms, players, questions and submissions of Obstacle Survival matches
-- stay (they are ordinary online rooms). Never run this on production without the owner's approval: it deletes every Obstacle Survival result and seat.
drop function if exists public.os_set_spectator(uuid,uuid,text);
drop function if exists public.os_touch(uuid,uuid,boolean);
drop function if exists public.os_input(uuid,uuid,text,bigint,jsonb,integer,integer,text,bigint,jsonb,jsonb);
drop function if exists public.os_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb);
drop function if exists public.os_create_session(uuid,uuid,text,jsonb,text,jsonb);
drop trigger if exists os_results_no_update on public.os_results;
drop table if exists public.os_outbox;
drop table if exists public.os_results;
drop table if exists public.os_credits;
drop table if exists public.os_input_batches;
drop table if exists public.os_events;
drop table if exists public.os_seats;
drop table if exists public.os_sessions;
drop function if exists public.os_results_immutable();
