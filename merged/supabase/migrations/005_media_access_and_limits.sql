-- 005_media_access_and_limits.sql — additive; apply AFTER 004. Back up first. Safe to re-run.
-- Fixes found while verifying the 160-item batch (see docs/QUIZ-PHASE2-AUDIT.md):
--   * one canonical media size cap (26,214,400 bytes = 25 MiB) shared by UI, route and database (004 said 20,000,000);
--   * 'pending' status for direct-to-storage uploads that are not finalized yet;
--   * reference-based media authorisation (media_assets.quiz_id was never populated, so "published quiz media" could not be authorised);
--   * clean-up that no longer deletes media still referenced by a quiz, a revision or a room, and that sweeps abandoned pending uploads;
--   * purged_at so the cron job can remove the storage object exactly once.

-- 1. Constraints (names differ between installs, so find them by definition) -------------------------------------------------
do $$
declare c record;
begin
 for c in select conname from pg_constraint where conrelid = 'public.media_assets'::regclass and contype = 'c'
          and (pg_get_constraintdef(oid) ilike '%bytes%' or pg_get_constraintdef(oid) ilike '%status%') loop
  execute format('alter table public.media_assets drop constraint %I', c.conname);
 end loop;
end $$;
alter table public.media_assets add constraint media_assets_bytes_check check (bytes between 1 and 26214400);
alter table public.media_assets add constraint media_assets_status_check check (status in ('pending','ready','quarantined','deleted'));
alter table public.media_assets add column if not exists purged_at timestamptz;
alter table public.media_assets add column if not exists finalized_at timestamptz;
create index if not exists media_assets_pending on public.media_assets(created_at) where status = 'pending';
create index if not exists media_assets_unpurged on public.media_assets(created_at) where status = 'deleted' and purged_at is null;

-- 2. Authorisation helpers: is this exact storage path used by a published quiz / by this room's immutable snapshot? ------------
create or replace function public.media_in_published_quiz(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
 select p_path ~ '^quiz-media/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
   and exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
               where q.status = 'published' and strpos(qq.payload::text, p_path) > 0);
$$;
create or replace function public.media_in_room(p_room uuid, p_path text)
returns boolean language sql stable security definer set search_path = public as $$
 select p_path ~ '^quiz-media/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
   and exists (select 1 from public.room_questions rq where rq.room_id = p_room and strpos(rq.payload::text, p_path) > 0);
$$;
revoke all on function public.media_in_published_quiz(text), public.media_in_room(uuid, text) from public, anon, authenticated;
grant execute on function public.media_in_published_quiz(text), public.media_in_room(uuid, text) to service_role;

-- 3. Clean-up: replaces 004's version ------------------------------------------------------------------------------------------
create or replace function public.cleanup_quiz_studio_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a integer; b integer; c integer; d integer;
begin
 delete from quiz_telemetry where created_at < now() - interval '30 days'; get diagnostics a = row_count;
 delete from audit_log where created_at < now() - interval '90 days'; get diagnostics b = row_count;
 -- Only media that NOTHING references any more: not a quiz question, not a saved revision, not a room snapshot.
 update media_assets m set status = 'deleted'
  where m.status = 'ready' and m.created_at < now() - interval '7 days'
    and not exists (select 1 from quiz_questions qq where strpos(qq.payload::text, m.storage_path) > 0)
    and not exists (select 1 from room_questions rq where strpos(rq.payload::text, m.storage_path) > 0)
    and not exists (select 1 from quiz_revisions r where strpos(r.doc::text, m.storage_path) > 0);
 get diagnostics c = row_count;
 -- Uploads that were authorised but never finalized (browser closed, network lost).
 update media_assets set status = 'deleted' where status = 'pending' and created_at < now() - interval '2 hours'; get diagnostics d = row_count;
 return jsonb_build_object('telemetry', a, 'audit', b, 'orphanMedia', c, 'abandonedUploads', d);
end; $$;
revoke all on function public.cleanup_quiz_studio_data() from public, anon, authenticated;
grant execute on function public.cleanup_quiz_studio_data() to service_role;
