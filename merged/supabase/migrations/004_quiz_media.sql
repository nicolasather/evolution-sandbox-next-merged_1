-- 004_quiz_media.sql — additive and idempotent. Run once in the Supabase SQL editor AFTER 001–003.
-- Adds: quiz settings, secure media (private bucket + metadata + references), and the question bank.
-- Nothing here touches the Evolution Sandbox. All access is through the server (service_role); anon/authenticated get nothing.

-- ── settings ──────────────────────────────────────────────────────────────
create table if not exists public.quiz_settings (
  quiz_id uuid primary key references public.quizzes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null,
  visibility text not null default 'unlisted' check (visibility in ('public','unlisted','private')),
  game_mode text not null default 'classic_quiz' check (game_mode in ('classic_quiz','tower_defense','obstacle_survival','clue_racing')),
  updated_at timestamptz not null default now()
);
create index if not exists quiz_settings_visibility on public.quiz_settings(visibility);

-- ── media ─────────────────────────────────────────────────────────────────
create table if not exists public.quiz_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image','gif','video')),
  mime text not null,
  declared_bytes bigint not null check (declared_bytes > 0),
  bytes bigint,
  width integer, height integer,
  path text not null unique,
  filename text not null default '',
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  ready_at timestamptz
);
create index if not exists quiz_media_owner on public.quiz_media(owner_id, created_at desc);
create index if not exists quiz_media_pending on public.quiz_media(created_at) where status <> 'ready';

create table if not exists public.quiz_media_refs (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  media_id uuid not null references public.quiz_media(id) on delete restrict,
  primary key (quiz_id, media_id)
);
create index if not exists quiz_media_refs_media on public.quiz_media_refs(media_id);

-- Private bucket: nothing is publicly readable; the server issues short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- NOTE: Supabase also has a project-wide upload limit (Storage settings). It must be at least 50 MB for videos.

-- ── question bank ─────────────────────────────────────────────────────────
create table if not exists public.quiz_bank_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('multiple_choice','answer_forge','connection_rush','truth_hunt','fill_table')),
  prompt text not null,
  question jsonb not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists quiz_bank_owner on public.quiz_bank_items(owner_id, created_at desc);

-- ── privileges & RLS (deny by default) ────────────────────────────────────
alter table public.quiz_settings enable row level security;
alter table public.quiz_media enable row level security;
alter table public.quiz_media_refs enable row level security;
alter table public.quiz_bank_items enable row level security;
grant select, insert, update, delete on public.quiz_settings, public.quiz_media, public.quiz_media_refs, public.quiz_bank_items to service_role;

-- ── cleanup of abandoned uploads (extends the existing cleanup cron) ──────
create or replace function public.cleanup_quiz_media() returns table(path text) language sql security definer set search_path = public as $$
  with gone as (
    delete from public.quiz_media m
    where (m.status <> 'ready' and m.created_at < now() - interval '2 hours')
       or (m.status = 'ready' and m.created_at < now() - interval '7 days'
           and not exists (select 1 from public.quiz_media_refs r where r.media_id = m.id))
    returning m.path
  ) select path from gone;
$$;
revoke all on function public.cleanup_quiz_media() from public, anon, authenticated;
grant execute on function public.cleanup_quiz_media() to service_role;
