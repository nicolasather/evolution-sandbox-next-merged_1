-- 007_tower_defense_down.sql — removes ONLY the Tower Defense objects added by 007. Rooms, players, questions and submissions of TD matches stay
-- (they are ordinary online rooms). Never run this on production without the owner's approval: it deletes every Tower Defense result.
drop function if exists public.td_set_spectator(uuid,uuid,text);
drop function if exists public.td_touch(uuid,uuid,boolean);
drop function if exists public.td_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb);
drop function if exists public.td_create_session(uuid,uuid,text,jsonb,text,jsonb);
drop trigger if exists td_results_no_update on public.td_results;
drop table if exists public.td_outbox;
drop table if exists public.td_results;
drop table if exists public.td_presence;
drop table if exists public.td_credits;
drop table if exists public.td_events;
drop table if exists public.td_sessions;
drop function if exists public.td_results_immutable();
