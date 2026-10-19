-- 006_projector_next_five.sql
-- Allows the five new classroom projector games (auction_house, territory_war, lucky_factory, pirate_voyage, final_showdown) in projector_sessions.
-- It ONLY widens the game allow-list: no data is changed, and RLS, revision locks, idempotency, grading, evidence, reward evaluation and every RPC
-- from 005 are untouched (none of them branch on the game key). Safe to run more than once.
BEGIN;

-- 005 declared the check inline, so its name is normally projector_sessions_game_check. Drop whatever check constraint covers the `game` column,
-- by lookup, so this also works if the constraint was ever renamed.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE ns.nspname = 'public' AND rel.relname = 'projector_sessions' AND con.contype = 'c' AND att.attname = 'game'
  LOOP
    EXECUTE format('ALTER TABLE public.projector_sessions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.projector_sessions
  ADD CONSTRAINT projector_sessions_game_check CHECK (game IN (
    'empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder',
    'auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown'
  ));

COMMIT;
