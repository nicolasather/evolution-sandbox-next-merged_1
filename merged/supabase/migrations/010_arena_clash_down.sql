-- 010_arena_clash_down.sql — removes ONLY the Arena Clash objects added by 010. Rooms, players, questions and submissions of Arena Clash matches stay (they are ordinary
-- online rooms). Never run this on production without the owner's approval: it DELETES every Arena Clash result, purchase and award history.
drop function if exists public.arena_save_checkpoint(uuid,text,bigint,bigint,jsonb);
drop function if exists public.arena_acquire_lease(uuid,text,integer);
drop function if exists public.arena_set_spectator(uuid,uuid,text);
drop function if exists public.arena_touch(uuid,uuid,boolean);
drop function if exists public.arena_input(uuid,uuid,bigint,jsonb);
drop function if exists public.arena_tick(uuid,bigint,jsonb,text);
drop function if exists public.arena_commit(uuid,text,text,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb,text);
drop function if exists public.arena_create_session(uuid,uuid,text,jsonb,text,jsonb);
drop trigger if exists arena_results_no_update on public.arena_results;
drop table if exists public.arena_outbox;
drop table if exists public.arena_results;
drop table if exists public.arena_purchases;
drop table if exists public.arena_awards;
drop table if exists public.arena_events;
drop table if exists public.arena_seats;
drop table if exists public.arena_sessions;
drop function if exists public.arena_results_immutable();
