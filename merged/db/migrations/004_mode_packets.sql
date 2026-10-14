-- Evolution Sandbox Phase 2 — mode packet guards (tickets 093, 097). Forward-only.
BEGIN;

ALTER TABLE creative.mode_packet ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE creative.mode_packet ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE creative.mode_packet ADD COLUMN IF NOT EXISTS packet_hash text;

ALTER TABLE creative.mode_packet DROP CONSTRAINT IF EXISTS mode_packet_mode_allowed;
ALTER TABLE creative.mode_packet ADD CONSTRAINT mode_packet_mode_allowed CHECK (mode_id IN
  ('survival','civilization','archaeology','decipher','escape-room','alien-archaeology','reverse-evolution','minimum-path','museum-draft'));

CREATE OR REPLACE FUNCTION creative.guard_mode_packet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('certified','rejected','draft') THEN RAISE EXCEPTION 'a packet is created certified, draft or rejected'; END IF;
    IF NEW.status = 'certified' AND (NEW.solver_certificate IS NULL OR NEW.packet_hash IS NULL) THEN
      RAISE EXCEPTION 'a certified packet needs a server-computed certificate and hash';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.packet IS DISTINCT FROM OLD.packet OR NEW.packet_hash IS DISTINCT FROM OLD.packet_hash
     OR NEW.solver_certificate IS DISTINCT FROM OLD.solver_certificate OR NEW.mode_id IS DISTINCT FROM OLD.mode_id
     OR NEW.seed IS DISTINCT FROM OLD.seed OR NEW.content_release_hash IS DISTINCT FROM OLD.content_release_hash THEN
    RAISE EXCEPTION 'mode packet content is immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='draft' AND NEW.status IN ('certified','rejected'))
         OR (OLD.status='certified' AND NEW.status IN ('approved','rejected'))
         OR (OLD.status='approved' AND NEW.status IN ('published','rejected'))) THEN
      RAISE EXCEPTION 'illegal mode packet transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.mode_id = 'museum-draft' AND NEW.status IN ('certified','approved','published') THEN
      RAISE EXCEPTION 'museum suggestions are drafts only; curated exhibits are never AI-published';
    END IF;
    IF NEW.status IN ('approved','published') AND NEW.reviewed_by IS NULL THEN RAISE EXCEPTION 'a reviewer is required'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creative_guard_mode_packet_ins ON creative.mode_packet;
CREATE TRIGGER creative_guard_mode_packet_ins BEFORE INSERT ON creative.mode_packet FOR EACH ROW EXECUTE FUNCTION creative.guard_mode_packet();
DROP TRIGGER IF EXISTS creative_guard_mode_packet_upd ON creative.mode_packet;
CREATE TRIGGER creative_guard_mode_packet_upd BEFORE UPDATE ON creative.mode_packet FOR EACH ROW EXECUTE FUNCTION creative.guard_mode_packet();

COMMIT;
