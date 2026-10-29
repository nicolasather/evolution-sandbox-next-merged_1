-- Reverses 012_moderation_controls.sql. Warnings, freezes and shadow-mutes are lost on rollback.
drop function if exists public.moderate_player_v2(uuid, uuid, uuid, text, boolean);
alter table public.players
  drop column if exists shadow_muted,
  drop column if exists score_frozen,
  drop column if exists warnings;
