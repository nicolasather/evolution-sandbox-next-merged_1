-- Evolution Sandbox V4 phase 2 starter migration — PostgreSQL 15+.
-- RUN ONLY on an owner-approved fresh staging database first.
-- Current canonical node JSON remains the truth; these are approved overlays and drafts.
BEGIN;
CREATE SCHEMA IF NOT EXISTS creative;
CREATE OR REPLACE FUNCTION creative.recipe_v2_key(ids text[]) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE size_n int; serialized text;
BEGIN
  size_n := cardinality(ids);
  IF size_n < 2 OR size_n > 5 THEN RAISE EXCEPTION 'ingredient count 2..5 required'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ids) AS u(id) WHERE id IS NULL OR id !~ '^[a-z][a-z0-9_]{1,63}$') THEN
    RAISE EXCEPTION 'invalid ingredient id';
  END IF;
  SELECT string_agg(length(u.id)::text || ':' || u.id, '' ORDER BY u.id COLLATE "C")
    INTO serialized FROM unnest(ids) AS u(id);
  RETURN 'recipe-v2:' || size_n::text || ':' || COALESCE(serialized,'');
END $$;
CREATE TABLE IF NOT EXISTS creative.approved_item_ref (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,63}$'),
  approved_source_hash text NOT NULL CHECK(length(approved_source_hash) >= 16),
  is_verified boolean NOT NULL DEFAULT false,
  canonical_era text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS creative.content_release (
  id bigserial PRIMARY KEY,
  manifest_sha256 text UNIQUE NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  parent_release_id bigint REFERENCES creative.content_release(id),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','validated','staged','active','revoked')),
  engine_source_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS creative_one_active_release ON creative.content_release(status) WHERE status='active';
CREATE TABLE IF NOT EXISTS creative.published_route (
  id bigserial PRIMARY KEY,
  release_id bigint NOT NULL REFERENCES creative.content_release(id),
  target_item_id text NOT NULL REFERENCES creative.approved_item_ref(id),
  ingredient_ids text[] NOT NULL,
  recipe_key text GENERATED ALWAYS AS (creative.recipe_v2_key(ingredient_ids)) STORED,
  action_key text NOT NULL DEFAULT '' CHECK(length(action_key) <= 64),
  source_proposal_id bigint,
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(release_id,recipe_key,action_key)
);
CREATE TABLE IF NOT EXISTS creative.recipe_proposal (
  id bigserial PRIMARY KEY,
  release_id bigint NOT NULL REFERENCES creative.content_release(id),
  target_item_id text NOT NULL REFERENCES creative.approved_item_ref(id),
  ingredient_ids text[] NOT NULL,
  recipe_key text GENERATED ALWAYS AS (creative.recipe_v2_key(ingredient_ids)) STORED,
  action_key text NOT NULL DEFAULT '',
  process_id text NOT NULL,
  mechanism text NOT NULL CHECK(length(mechanism) <= 600),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_id text NOT NULL,
  prompt_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','superseded')),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version > 0),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(release_id,recipe_key,action_key,target_item_id,prompt_version)
);
ALTER TABLE creative.published_route ADD CONSTRAINT creative_route_source_proposal_fk
  FOREIGN KEY(source_proposal_id) REFERENCES creative.recipe_proposal(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE IF NOT EXISTS creative.creative_compute (
  id bigserial PRIMARY KEY,
  compute_key text UNIQUE NOT NULL,
  release_id bigint NOT NULL REFERENCES creative.content_release(id),
  recipe_key text NOT NULL,
  action_key text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','none','pending_review','failed')),
  lease_until timestamptz,
  model_request_id text,
  proposal_id bigint REFERENCES creative.recipe_proposal(id),
  result_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS creative.attempt_alias (
  actor_hash text NOT NULL,
  attempt_id text NOT NULL,
  compute_id bigint NOT NULL REFERENCES creative.creative_compute(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_hash,attempt_id)
);
CREATE TABLE IF NOT EXISTS creative.negative_cache (
  cache_key text PRIMARY KEY,
  reason_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS creative.asset_job (
  id bigserial PRIMARY KEY,
  item_id text NOT NULL REFERENCES creative.approved_item_ref(id),
  visual_brief_hash text NOT NULL,
  style_version text NOT NULL,
  provider_version text NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','generated','validated','pending_review','published','retryable_failure','permanent_failure')),
  provider_task_id text,
  worker_id text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id,visual_brief_hash,style_version,provider_version)
);
CREATE TABLE IF NOT EXISTS creative.visual_asset (
  id bigserial PRIMARY KEY,
  job_id bigint NOT NULL UNIQUE REFERENCES creative.asset_job(id),
  item_id text NOT NULL REFERENCES creative.approved_item_ref(id),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','validated','approved','published','rejected')),
  storage_key text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK(media_type IN ('model/gltf-binary','image/webp','image/png')),
  size_bytes bigint NOT NULL CHECK(size_bytes > 0),
  sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS creative.mode_packet (
  id bigserial PRIMARY KEY,
  mode_id text NOT NULL,
  mode_contract_version text NOT NULL,
  content_release_hash text NOT NULL,
  pool_hash text NOT NULL,
  seed bigint NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','certified','approved','published','rejected')),
  packet jsonb NOT NULL,
  solver_certificate jsonb,
  model_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mode_id,mode_contract_version,content_release_hash,pool_hash,seed,prompt_version)
);
CREATE TABLE IF NOT EXISTS creative.usage_ledger (
  id bigserial PRIMARY KEY,
  compute_id bigint REFERENCES creative.creative_compute(id),
  job_id bigint REFERENCES creative.asset_job(id),
  provider text NOT NULL,
  external_request_id text UNIQUE,
  reserved_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK(reserved_usd >= 0),
  settled_usd numeric(12,6) CHECK(settled_usd >= 0),
  input_tokens integer CHECK(input_tokens >= 0),
  output_tokens integer CHECK(output_tokens >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','settled','released','unknown')), 
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS creative.audit_event (
  id bigserial PRIMARY KEY,
  actor_role text NOT NULL,
  actor_hash text,
  kind text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creative_proposals_pending_idx ON creative.recipe_proposal(status, created_at);
CREATE INDEX IF NOT EXISTS creative_jobs_ready_idx ON creative.asset_job(state, next_retry_at);
CREATE INDEX IF NOT EXISTS creative_negative_expiry_idx ON creative.negative_cache(expires_at);
COMMIT;
