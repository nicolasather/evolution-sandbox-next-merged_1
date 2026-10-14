-- Evolution Sandbox Phase 2 — guard migration (ticket 076/081/082). PostgreSQL 15+.
-- Adds what the starter schema leaves to application code: state machines, immutability, one-approved-route
-- uniqueness and runtime kill-switch state. Forward-only; apply to a fresh staging database first.
BEGIN;

CREATE TABLE IF NOT EXISTS creative.runtime_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A previously approved route always wins: two approved proposals can never share a recipe + action.
CREATE UNIQUE INDEX IF NOT EXISTS creative_one_approved_per_recipe
  ON creative.recipe_proposal(recipe_key, action_key) WHERE status = 'approved';

-- ---- proposal: pending -> approved | rejected | superseded, never back; facts are immutable ---------------
CREATE OR REPLACE FUNCTION creative.guard_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ingredient_ids IS DISTINCT FROM OLD.ingredient_ids OR NEW.target_item_id IS DISTINCT FROM OLD.target_item_id
     OR NEW.mechanism IS DISTINCT FROM OLD.mechanism OR NEW.action_key IS DISTINCT FROM OLD.action_key
     OR NEW.model_id IS DISTINCT FROM OLD.model_id OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version THEN
    RAISE EXCEPTION 'proposal facts are immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'illegal proposal transition % -> %', OLD.status, NEW.status; END IF;
    IF NEW.row_version <= OLD.row_version THEN RAISE EXCEPTION 'row_version must increase on a transition'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_guard_proposal ON creative.recipe_proposal;
CREATE TRIGGER creative_guard_proposal BEFORE UPDATE ON creative.recipe_proposal
  FOR EACH ROW EXECUTE FUNCTION creative.guard_proposal();

-- ---- release: draft -> validated -> staged -> active -> revoked; revoked -> active only if it was active once ----
CREATE OR REPLACE FUNCTION creative.guard_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256 OR NEW.parent_release_id IS DISTINCT FROM OLD.parent_release_id
     OR NEW.engine_source_hash IS DISTINCT FROM OLD.engine_source_hash THEN
    RAISE EXCEPTION 'release manifest is immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status = 'draft' AND NEW.status = 'validated')
         OR (OLD.status = 'validated' AND NEW.status = 'staged')
         OR (OLD.status = 'staged' AND NEW.status = 'active')
         OR (OLD.status = 'active' AND NEW.status = 'revoked')
         OR (OLD.status = 'revoked' AND NEW.status = 'active' AND OLD.activated_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'illegal release transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'active' THEN NEW.activated_at := COALESCE(NEW.activated_at, now()); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_guard_release ON creative.content_release;
CREATE TRIGGER creative_guard_release BEFORE UPDATE ON creative.content_release
  FOR EACH ROW EXECUTE FUNCTION creative.guard_release();

-- ---- published routes and audit rows are append-only; routes may only point at verified targets ----------
CREATE OR REPLACE FUNCTION creative.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% on % is not allowed (append-only)', TG_OP, TG_TABLE_NAME; END $$;
DROP TRIGGER IF EXISTS creative_route_append_only ON creative.published_route;
CREATE TRIGGER creative_route_append_only BEFORE UPDATE OR DELETE ON creative.published_route
  FOR EACH ROW EXECUTE FUNCTION creative.forbid_change();
DROP TRIGGER IF EXISTS creative_audit_append_only ON creative.audit_event;
CREATE TRIGGER creative_audit_append_only BEFORE UPDATE OR DELETE ON creative.audit_event
  FOR EACH ROW EXECUTE FUNCTION creative.forbid_change();

CREATE OR REPLACE FUNCTION creative.route_target_verified() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM creative.approved_item_ref WHERE id = NEW.target_item_id AND is_verified) THEN
    RAISE EXCEPTION 'route target % is not a verified approved item', NEW.target_item_id;
  END IF;
  IF NEW.target_item_id = ANY(NEW.ingredient_ids) THEN RAISE EXCEPTION 'a route cannot use its own target as an ingredient'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_route_verified ON creative.published_route;
CREATE TRIGGER creative_route_verified BEFORE INSERT ON creative.published_route
  FOR EACH ROW EXECUTE FUNCTION creative.route_target_verified();

-- proposals too: only verified targets, never self-referencing
CREATE OR REPLACE FUNCTION creative.proposal_target_verified() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM creative.approved_item_ref WHERE id = NEW.target_item_id AND is_verified) THEN
    RAISE EXCEPTION 'proposal target % is not a verified approved item', NEW.target_item_id;
  END IF;
  IF NEW.target_item_id = ANY(NEW.ingredient_ids) THEN RAISE EXCEPTION 'a proposal cannot use its own target as an ingredient'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_proposal_verified ON creative.recipe_proposal;
CREATE TRIGGER creative_proposal_verified BEFORE INSERT ON creative.recipe_proposal
  FOR EACH ROW EXECUTE FUNCTION creative.proposal_target_verified();

COMMIT;
