-- 012 · Moderation controls: warn, freeze score, shadow-mute (ghost mode).
-- Additive only. Existing columns, RPCs and rows are untouched. Points corrections keep using adjust_points (migration 004).
-- Every new column defaults to off, so rooms created before this migration behave exactly as before.

alter table public.players
  add column if not exists shadow_muted boolean not null default false,
  add column if not exists score_frozen boolean not null default false,
  add column if not exists warnings integer not null default 0 check (warnings >= 0);

-- Host-only, audited. `p_on` is ignored for warn (each warn adds one).
create or replace function public.moderate_player_v2(p_room uuid, p_host uuid, p_player uuid, p_action text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_player players%rowtype;
begin
  select * into r from rooms where id = p_room and host_id = p_host for update;
  if not found then raise exception 'Room not found'; end if;
  if p_action not in ('warn', 'freeze', 'shadow') then raise exception 'Unknown action'; end if;
  select * into v_player from players where id = p_player and room_id = p_room for update;
  if not found then raise exception 'Player not found'; end if;

  if p_action = 'warn' then
    update players set warnings = warnings + 1 where id = p_player;
  elsif p_action = 'freeze' then
    update players set score_frozen = coalesce(p_on, false) where id = p_player;
  else
    update players set shadow_muted = coalesce(p_on, false) where id = p_player;
  end if;

  insert into audit_log(room_id, actor_id, action, detail)
    values (p_room, p_host, 'player_' || p_action, jsonb_build_object('player', p_player, 'on', p_on));
  return jsonb_build_object('ok', true);
end; $$;

revoke execute on function public.moderate_player_v2(uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.moderate_player_v2(uuid, uuid, uuid, text, boolean) to service_role;
