-- 006_projector_next_five_down.sql: restores the five-game allow-list.
-- Sessions of the five new games cannot satisfy the old constraint, so they are removed first, together with their event log and teaching evidence
-- (reward ledger rows follow the evidence by foreign key). Everything for the original five games, and all quizzes and rooms, is kept.
BEGIN;
DELETE FROM public.projector_events WHERE room_id IN (SELECT room_id FROM public.projector_sessions WHERE game IN ('auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown'));
DELETE FROM public.projector_teaching_evidence WHERE game IN ('auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown');
DELETE FROM public.projector_sessions WHERE game IN ('auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown');
ALTER TABLE public.projector_sessions DROP CONSTRAINT IF EXISTS projector_sessions_game_check;
ALTER TABLE public.projector_sessions
  ADD CONSTRAINT projector_sessions_game_check CHECK (game IN ('empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder'));
COMMIT;
