-- 003_service_role_grants.sql — additive. The server-only role (service_role) needs table privileges on the quiz tables.
-- anon / authenticated are deliberately NOT granted anything: all access goes through the server.
grant select, insert, update, delete on
  public.quizzes, public.quiz_questions, public.rooms, public.room_questions,
  public.teams, public.players, public.submissions, public.score_events,
  public.rate_limits
to service_role;
grant usage on all sequences in schema public to service_role;
