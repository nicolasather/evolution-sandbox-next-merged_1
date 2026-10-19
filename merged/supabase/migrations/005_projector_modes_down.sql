-- 005_projector_modes_down.sql — reverses 005 only. Projector game state, events, evidence and appeals are discarded;
-- quizzes, rooms, teams, submissions, scores and everything from 001–004 are untouched.
drop function if exists public.projector_appeal_reward(uuid,uuid,text);
drop function if exists public.projector_evaluate_reward(uuid,uuid);
drop function if exists public.projector_add_repeat_cycle(uuid,uuid,boolean,integer);
drop function if exists public.projector_extend_time(uuid,uuid,integer,text);
drop function if exists public.projector_open_question(uuid,uuid,integer,uuid[]);
drop function if exists public.projector_commit(uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,boolean);
drop function if exists public.projector_create_session(uuid,uuid,text,jsonb,jsonb);
drop table if exists public.projector_reward_appeals, public.projector_reward_ledger, public.projector_teaching_evidence, public.projector_events, public.projector_sessions;
