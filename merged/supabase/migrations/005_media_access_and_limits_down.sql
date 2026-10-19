-- 005_media_access_and_limits_down.sql — reverses 005 only. Does NOT delete any media rows or files.
-- WARNING: rows larger than 20,000,000 bytes or with status 'pending' would violate 004's constraints, so the old constraints are added NOT VALID
-- (enforced for new rows only). Take a backup and obtain approval before running.
drop function if exists public.media_in_published_quiz(text);
drop function if exists public.media_in_room(uuid, text);
drop index if exists public.media_assets_pending; drop index if exists public.media_assets_unpurged;
alter table public.media_assets drop constraint if exists media_assets_bytes_check;
alter table public.media_assets drop constraint if exists media_assets_status_check;
alter table public.media_assets add constraint media_assets_bytes_check check (bytes between 1 and 20000000) not valid;
alter table public.media_assets add constraint media_assets_status_check check (status in ('ready','quarantined','deleted')) not valid;
alter table public.media_assets drop column if exists purged_at, drop column if exists finalized_at;
create or replace function public.cleanup_quiz_studio_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a integer; b integer; c integer;
begin
 delete from quiz_telemetry where created_at < now() - interval '30 days'; get diagnostics a = row_count;
 delete from audit_log where created_at < now() - interval '90 days'; get diagnostics b = row_count;
 update media_assets set status='deleted' where status='ready' and quiz_id is null and created_at < now() - interval '7 days'; get diagnostics c = row_count;
 return jsonb_build_object('telemetry',a,'audit',b,'orphanMedia',c);
end; $$;
