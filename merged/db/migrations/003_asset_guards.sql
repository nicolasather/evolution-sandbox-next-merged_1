-- Evolution Sandbox Phase 2 — asset guard migration (tickets 089, 092). Forward-only.
BEGIN;

-- an asset job can only ever be created for a verified approved item, and its identity never changes
CREATE OR REPLACE FUNCTION creative.guard_asset_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM creative.approved_item_ref WHERE id = NEW.item_id AND is_verified) THEN
      RAISE EXCEPTION 'asset job item % is not a verified approved item', NEW.item_id;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.visual_brief_hash IS DISTINCT FROM OLD.visual_brief_hash
     OR NEW.style_version IS DISTINCT FROM OLD.style_version OR NEW.provider_version IS DISTINCT FROM OLD.provider_version THEN
    RAISE EXCEPTION 'asset job identity is immutable';
  END IF;
  IF OLD.state IN ('published','permanent_failure') AND NEW.state IS DISTINCT FROM OLD.state THEN
    RAISE EXCEPTION 'asset job % is final', OLD.state;
  END IF;
  IF OLD.provider_task_id IS NOT NULL AND NEW.provider_task_id IS DISTINCT FROM OLD.provider_task_id THEN
    RAISE EXCEPTION 'provider task id is write-once (a retry must resume it, never resubmit)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_guard_asset_job_ins ON creative.asset_job;
CREATE TRIGGER creative_guard_asset_job_ins BEFORE INSERT ON creative.asset_job FOR EACH ROW EXECUTE FUNCTION creative.guard_asset_job();
DROP TRIGGER IF EXISTS creative_guard_asset_job_upd ON creative.asset_job;
CREATE TRIGGER creative_guard_asset_job_upd BEFORE UPDATE ON creative.asset_job FOR EACH ROW EXECUTE FUNCTION creative.guard_asset_job();

-- visual asset: draft -> validated -> approved -> published; rejected from any non-final state; bytes never change
CREATE OR REPLACE FUNCTION creative.guard_visual_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR NEW.media_type IS DISTINCT FROM OLD.media_type OR NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    RAISE EXCEPTION 'visual asset content is immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='draft' AND NEW.status IN ('validated','rejected'))
         OR (OLD.status='validated' AND NEW.status IN ('approved','rejected'))
         OR (OLD.status='approved' AND NEW.status IN ('published','rejected'))) THEN
      RAISE EXCEPTION 'illegal visual asset transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status IN ('approved','published') AND NEW.reviewed_by IS NULL THEN
      RAISE EXCEPTION 'a human reviewer is required for %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_guard_visual_asset ON creative.visual_asset;
CREATE TRIGGER creative_guard_visual_asset BEFORE UPDATE ON creative.visual_asset FOR EACH ROW EXECUTE FUNCTION creative.guard_visual_asset();

COMMIT;
