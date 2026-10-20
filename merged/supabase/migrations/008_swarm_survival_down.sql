-- 008_swarm_survival_down.sql — removes ONLY the Swarm Survival objects added by 008. Rooms, players, questions and quizzes are untouched.
-- Never run on production without the owner's approval: it deletes every Swarm Survival checkpoint, answer, credit and result.
drop function if exists public.swarm_save_checkpoint(uuid,text,bigint,jsonb);
drop function if exists public.swarm_create_session(uuid,uuid,jsonb,bigint);
drop function if exists public.swarm_acquire_lease(uuid,text,integer);
drop trigger if exists swarm_results_no_update on public.swarm_results;
drop table if exists public.swarm_results;
drop table if exists public.swarm_audit;
drop table if exists public.swarm_purchases;
drop table if exists public.swarm_credits;
drop table if exists public.swarm_answers;
drop table if exists public.swarm_participants;
drop table if exists public.swarm_sessions;
drop function if exists public.swarm_results_immutable();
