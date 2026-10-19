-- 004_quiz_studio_160_down.sql — reverses 004 only. Data in the new tables/columns is discarded; existing quizzes, rooms and scores are untouched.
drop function if exists public.cleanup_quiz_studio_data();
drop function if exists public.control_room_v2(uuid,uuid,text);
drop function if exists public.commit_answer_v2(uuid,uuid,text,uuid,jsonb,boolean,integer,integer,boolean,integer,boolean);
drop function if exists public.adjust_points(uuid,uuid,text,uuid,integer,text);
drop function if exists public.moderate_player(uuid,uuid,uuid,text);
drop function if exists public.join_room_v2(text,text,text,text);
drop function if exists public.save_owned_quiz_v2(uuid,uuid,text,text,text,jsonb,jsonb);
drop table if exists public.quiz_telemetry, public.cosmetic_profiles, public.cosmetic_events, public.audit_log, public.content_reports, public.media_assets, public.quiz_revisions;
alter table public.players drop column if exists privacy_bucket, drop column if exists identity, drop column if exists status;
drop index if exists public.quizzes_meta_gin;
alter table public.quizzes drop column if exists source_quiz_id, drop column if exists review_state, drop column if exists archived_at, drop column if exists meta;
