-- 011_clue_racing_down.sql — removes ONLY the Clue Racing objects added by 011. Rooms, players, questions and submissions of Clue Racing matches stay (they are ordinary
-- online rooms). Never run this on production without the owner's approval: it DELETES every Clue Racing result, purchase and award history.
drop function if exists public.cr_save_checkpoint(uuid,text,bigint,bigint,jsonb);
drop function if exists public.cr_acquire_lease(uuid,text,integer);
drop function if exists public.cr_set_spectator(uuid,uuid,text);
drop function if exists public.cr_touch(uuid,uuid,boolean);
drop function if exists public.cr_input(uuid,uuid,bigint,jsonb);
drop function if exists public.cr_tick(uuid,bigint,jsonb,text);
drop function if exists public.cr_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb,text);
drop function if exists public.cr_create_session(uuid,uuid,text,jsonb,text,jsonb);
drop trigger if exists cr_results_no_update on public.cr_results;
drop table if exists public.cr_outbox;
drop table if exists public.cr_results;
drop table if exists public.cr_purchases;
drop table if exists public.cr_awards;
drop table if exists public.cr_events;
drop table if exists public.cr_seats;
drop table if exists public.cr_sessions;
drop function if exists public.cr_results_immutable();
