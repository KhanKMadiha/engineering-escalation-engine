-- Phase 3A staging schema bootstrap
-- Target: engineering-escalation-staging ONLY
-- Do NOT run against production zfpakilfxnwhlcfjgemw
-- Skips 20261122120000_assessment_versions_and_multi_decisions.sql

-- =============================================================================
-- BEGIN 20260907000000_phase7_persistence.sql
-- =============================================================================
-- Engineering Escalation Engine — Phase 7 schema
-- Apply in Supabase SQL Editor or via `psql` / migration tooling.
-- No credentials included.

-- Enums (domain-aligned)
DO $$ BEGIN
  CREATE TYPE case_status AS ENUM (
    'draft',
    'submitted',
    'analyzing',
    'awaiting_decision',
    'escalated',
    'investigation_continues',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE environment AS ENUM (
    'production',
    'staging',
    'development',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE escalation_recommendation AS ENUM (
    'escalate',
    'continue_investigation',
    'insufficient_evidence'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE human_decision_type AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Core case
CREATE TABLE IF NOT EXISTS support_cases (
  id UUID PRIMARY KEY,
  customer TEXT NOT NULL,
  product TEXT NOT NULL,
  severity severity NOT NULL,
  issue_title TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  environment environment NOT NULL,
  expected_behaviour TEXT NOT NULL,
  actual_behaviour TEXT NOT NULL,
  troubleshooting_performed TEXT NOT NULL,
  logs_errors TEXT NOT NULL,
  request_ids TEXT NOT NULL,
  incident_timestamp TIMESTAMPTZ NULL,
  affected_customer_count INTEGER NULL
    CHECK (
      affected_customer_count IS NULL
      OR (affected_customer_count >= 1 AND affected_customer_count <= 1000000)
    ),
  status case_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_cases_status ON support_cases (status);
CREATE INDEX IF NOT EXISTS idx_support_cases_created_at ON support_cases (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_cases_updated_at ON support_cases (updated_at DESC);

-- One current analysis per case (document-like JSON for structured AI payload)
-- JSONB choices: ai_result, evidence arrays, provenance are nested document data
-- from the AI/validation layer; normalizing them would add little query value.
CREATE TABLE IF NOT EXISTS case_analyses (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL UNIQUE REFERENCES support_cases (id) ON DELETE CASCADE,
  ai_result JSONB NOT NULL,
  validated_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_completeness_score DOUBLE PRECISION NOT NULL
    CHECK (evidence_completeness_score >= 0 AND evidence_completeness_score <= 1),
  provenance JSONB NULL,
  analysis_warnings JSONB NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_case_analyses_case_id ON case_analyses (case_id);

-- One current escalation engine result per case
CREATE TABLE IF NOT EXISTS escalation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES support_cases (id) ON DELETE CASCADE,
  escalation_score INTEGER NOT NULL
    CHECK (escalation_score >= 0 AND escalation_score <= 100),
  recommendation escalation_recommendation NOT NULL,
  contributing_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'deterministic_engine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_results_case_id ON escalation_results (case_id);

-- One authoritative human decision per case
CREATE TABLE IF NOT EXISTS human_decisions (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL UNIQUE REFERENCES support_cases (id) ON DELETE CASCADE,
  decision human_decision_type NOT NULL,
  rationale TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  decided_by TEXT NOT NULL,
  escalation_score_at_decision INTEGER NOT NULL
    CHECK (escalation_score_at_decision >= 0 AND escalation_score_at_decision <= 100),
  recommendation_at_decision escalation_recommendation NOT NULL,
  source TEXT NOT NULL DEFAULT 'human_decision'
);

CREATE INDEX IF NOT EXISTS idx_human_decisions_case_id ON human_decisions (case_id);

-- One engineering handoff per case (created only on approval)
CREATE TABLE IF NOT EXISTS engineering_handoffs (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL UNIQUE REFERENCES support_cases (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  customer_impact TEXT NOT NULL,
  environment TEXT NOT NULL,
  reported_severity severity NOT NULL,
  affected_customer_count INTEGER NULL,
  issue_category TEXT NOT NULL,
  reproducibility TEXT NOT NULL,
  troubleshooting_performed TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  suspected_root_cause TEXT NOT NULL,
  escalation_score INTEGER NOT NULL,
  escalation_recommendation escalation_recommendation NOT NULL,
  decision_rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'engineering_handoff'
);

CREATE INDEX IF NOT EXISTS idx_engineering_handoffs_case_id ON engineering_handoffs (case_id);

-- Audit trail
CREATE TABLE IF NOT EXISTS case_events (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES support_cases (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events (case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_events_case_created ON case_events (case_id, created_at DESC);

-- Atomic decision outcome: decision (+ optional handoff) + status + events
-- Business rules remain in DecisionService; this RPC only guarantees persistence consistency.
CREATE OR REPLACE FUNCTION persist_decision_outcome(
  p_case_id UUID,
  p_decision JSONB,
  p_handoff JSONB,
  p_target_status case_status,
  p_events JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event JSONB;
BEGIN
  -- Only allow transition from awaiting_decision
  UPDATE support_cases
  SET
    status = p_target_status,
    updated_at = now()
  WHERE id = p_case_id
    AND status = 'awaiting_decision';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_AWAITING_DECISION'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO human_decisions (
    id,
    case_id,
    decision,
    rationale,
    decided_at,
    decided_by,
    escalation_score_at_decision,
    recommendation_at_decision,
    source
  ) VALUES (
    (p_decision->>'id')::uuid,
    p_case_id,
    (p_decision->>'decision')::human_decision_type,
    p_decision->>'rationale',
    (p_decision->>'decidedAt')::timestamptz,
    p_decision->>'decidedBy',
    (p_decision->>'escalationScoreAtDecision')::integer,
    (p_decision->>'recommendationAtDecision')::escalation_recommendation,
    COALESCE(p_decision->>'source', 'human_decision')
  );

  IF p_handoff IS NOT NULL THEN
    INSERT INTO engineering_handoffs (
      id,
      case_id,
      title,
      summary,
      customer_impact,
      environment,
      reported_severity,
      affected_customer_count,
      issue_category,
      reproducibility,
      troubleshooting_performed,
      evidence,
      missing_evidence,
      suspected_root_cause,
      escalation_score,
      escalation_recommendation,
      decision_rationale,
      created_at,
      source
    ) VALUES (
      (p_handoff->>'id')::uuid,
      p_case_id,
      p_handoff->>'title',
      p_handoff->>'summary',
      p_handoff->>'customerImpact',
      p_handoff->>'environment',
      (p_handoff->>'reportedSeverity')::severity,
      NULLIF(p_handoff->>'affectedCustomerCount', '')::integer,
      p_handoff->>'issueCategory',
      p_handoff->>'reproducibility',
      p_handoff->>'troubleshootingPerformed',
      COALESCE(p_handoff->'evidence', '[]'::jsonb),
      COALESCE(p_handoff->'missingEvidence', '[]'::jsonb),
      p_handoff->>'suspectedRootCause',
      (p_handoff->>'escalationScore')::integer,
      (p_handoff->>'escalationRecommendation')::escalation_recommendation,
      p_handoff->>'decisionRationale',
      (p_handoff->>'createdAt')::timestamptz,
      COALESCE(p_handoff->>'source', 'engineering_handoff')
    );
  END IF;

  FOR v_event IN SELECT * FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb))
  LOOP
    INSERT INTO case_events (id, case_id, event_type, metadata, created_at)
    VALUES (
      (v_event->>'id')::uuid,
      p_case_id,
      v_event->>'eventType',
      v_event->'metadata',
      (v_event->>'createdAt')::timestamptz
    );
  END LOOP;
END;
$$;
-- END 20260907000000_phase7_persistence.sql

-- =============================================================================
-- BEGIN 20260907090000_reproduction_fields.sql
-- =============================================================================
-- Reproduction / behaviour fields as first-class optional case information.
-- Existing rows remain valid (NULL / empty treated as not provided).

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS steps_to_reproduce TEXT NULL;

ALTER TABLE support_cases
  ALTER COLUMN expected_behaviour DROP NOT NULL;

ALTER TABLE support_cases
  ALTER COLUMN actual_behaviour DROP NOT NULL;

ALTER TABLE engineering_handoffs
  ADD COLUMN IF NOT EXISTS steps_to_reproduce TEXT NOT NULL DEFAULT 'Not provided';

ALTER TABLE engineering_handoffs
  ADD COLUMN IF NOT EXISTS expected_behaviour TEXT NOT NULL DEFAULT 'Not provided';

ALTER TABLE engineering_handoffs
  ADD COLUMN IF NOT EXISTS actual_behaviour TEXT NOT NULL DEFAULT 'Not provided';

-- Refresh atomic decision RPC to persist new handoff fields.
CREATE OR REPLACE FUNCTION persist_decision_outcome(
  p_case_id UUID,
  p_decision JSONB,
  p_handoff JSONB,
  p_target_status case_status,
  p_events JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event JSONB;
BEGIN
  UPDATE support_cases
  SET
    status = p_target_status,
    updated_at = now()
  WHERE id = p_case_id
    AND status = 'awaiting_decision';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_AWAITING_DECISION'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO human_decisions (
    id,
    case_id,
    decision,
    rationale,
    decided_at,
    decided_by,
    escalation_score_at_decision,
    recommendation_at_decision,
    source
  ) VALUES (
    (p_decision->>'id')::uuid,
    p_case_id,
    (p_decision->>'decision')::human_decision_type,
    p_decision->>'rationale',
    (p_decision->>'decidedAt')::timestamptz,
    p_decision->>'decidedBy',
    (p_decision->>'escalationScoreAtDecision')::integer,
    (p_decision->>'recommendationAtDecision')::escalation_recommendation,
    COALESCE(p_decision->>'source', 'human_decision')
  );

  IF p_handoff IS NOT NULL THEN
    INSERT INTO engineering_handoffs (
      id,
      case_id,
      title,
      summary,
      customer_impact,
      environment,
      reported_severity,
      affected_customer_count,
      issue_category,
      steps_to_reproduce,
      expected_behaviour,
      actual_behaviour,
      reproducibility,
      troubleshooting_performed,
      evidence,
      missing_evidence,
      suspected_root_cause,
      escalation_score,
      escalation_recommendation,
      decision_rationale,
      created_at,
      source
    ) VALUES (
      (p_handoff->>'id')::uuid,
      p_case_id,
      p_handoff->>'title',
      p_handoff->>'summary',
      p_handoff->>'customerImpact',
      p_handoff->>'environment',
      (p_handoff->>'reportedSeverity')::severity,
      NULLIF(p_handoff->>'affectedCustomerCount', '')::integer,
      p_handoff->>'issueCategory',
      COALESCE(NULLIF(p_handoff->>'stepsToReproduce', ''), 'Not provided'),
      COALESCE(NULLIF(p_handoff->>'expectedBehaviour', ''), 'Not provided'),
      COALESCE(NULLIF(p_handoff->>'actualBehaviour', ''), 'Not provided'),
      p_handoff->>'reproducibility',
      p_handoff->>'troubleshootingPerformed',
      COALESCE(p_handoff->'evidence', '[]'::jsonb),
      COALESCE(p_handoff->'missingEvidence', '[]'::jsonb),
      p_handoff->>'suspectedRootCause',
      (p_handoff->>'escalationScore')::integer,
      (p_handoff->>'escalationRecommendation')::escalation_recommendation,
      p_handoff->>'decisionRationale',
      (p_handoff->>'createdAt')::timestamptz,
      COALESCE(p_handoff->>'source', 'engineering_handoff')
    );
  END IF;

  FOR v_event IN SELECT * FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb))
  LOOP
    INSERT INTO case_events (id, case_id, event_type, metadata, created_at)
    VALUES (
      (v_event->>'id')::uuid,
      p_case_id,
      v_event->>'eventType',
      v_event->'metadata',
      (v_event->>'createdAt')::timestamptz
    );
  END LOOP;
END;
$$;
-- END 20260907090000_reproduction_fields.sql

-- =============================================================================
-- BEGIN 20260911120000_issue_first_observed.sql
-- =============================================================================
-- Optional approximate "issue first observed" timeframe (free text).
-- Kept separate from incident_timestamp (TIMESTAMPTZ) — never parse free text into a datetime.

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS issue_first_observed TEXT NULL;
-- END 20260911120000_issue_first_observed.sql

-- =============================================================================
-- BEGIN 20261120120000_ticket_import_fields.sql
-- =============================================================================
-- Additive ticket import provenance for Freshdesk (and future providers).
-- Nullable so existing rows and manual creates remain valid.

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS source_system TEXT NULL;

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS external_ticket_id TEXT NULL;

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS external_url TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_cases_source_external
  ON support_cases (source_system, external_ticket_id)
  WHERE source_system IS NOT NULL AND external_ticket_id IS NOT NULL;
-- END 20261120120000_ticket_import_fields.sql

-- =============================================================================
-- BEGIN 20261121160000_technical_evidence.sql
-- =============================================================================
-- Phase B: structured technical evidence (independent of AI analysis).
-- Reversible: see matching down migration notes at end of file.
-- Do NOT apply to production without explicit approval.

-- Evidence type taxonomy (presentation + storage)
DO $$ BEGIN
  CREATE TYPE technical_evidence_type AS ENUM (
    'application_log',
    'datadog_log',
    'datadog_trace',
    'api_response',
    'postman_result',
    'auth_error',
    'screenshot',
    'attachment',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technical_evidence_source AS ENUM (
    'customer',
    'support',
    'imported',
    'demo_fictional'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technical_evidence_verification AS ENUM (
    'recorded',
    'support_verified',
    'unverified',
    'rejected',
    'demo_fictional'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS case_technical_evidence (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES support_cases (id) ON DELETE CASCADE,
  evidence_type technical_evidence_type NOT NULL,
  title TEXT NOT NULL,
  service TEXT NULL,
  body TEXT NULL,
  caption TEXT NULL,
  captured_at TIMESTAMPTZ NULL,
  request_id TEXT NULL,
  trace_id TEXT NULL,
  external_url TEXT NULL,
  source technical_evidence_source NOT NULL,
  verification_status technical_evidence_verification NOT NULL DEFAULT 'recorded',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT case_technical_evidence_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT case_technical_evidence_body_len CHECK (body IS NULL OR char_length(body) <= 100000),
  CONSTRAINT case_technical_evidence_caption_len CHECK (caption IS NULL OR char_length(caption) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_case_id
  ON case_technical_evidence (case_id);
CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_case_sort
  ON case_technical_evidence (case_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_type
  ON case_technical_evidence (evidence_type);

CREATE TABLE IF NOT EXISTS case_technical_evidence_attachments (
  id UUID PRIMARY KEY,
  evidence_id UUID NOT NULL REFERENCES case_technical_evidence (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 5242880),
  width_px INTEGER NULL,
  height_px INTEGER NULL,
  checksum_sha256 TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT case_technical_evidence_attachments_content_type_chk
    CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT case_technical_evidence_attachments_path_uniq UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_attachments_evidence_id
  ON case_technical_evidence_attachments (evidence_id);

-- RLS: deny by default for anon/authenticated. Service-role bypasses RLS.
-- Application layer must still verify case existence before reads/writes.
ALTER TABLE case_technical_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_technical_evidence_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_technical_evidence_deny_all ON case_technical_evidence;
CREATE POLICY case_technical_evidence_deny_all
  ON case_technical_evidence
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS case_technical_evidence_attachments_deny_all
  ON case_technical_evidence_attachments;
CREATE POLICY case_technical_evidence_attachments_deny_all
  ON case_technical_evidence_attachments
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Private storage bucket for evidence screenshots (service-role uploads).
-- Only runs when Supabase Storage is available. Public URL guessing must not
-- grant access; use short-lived signed URLs from the server.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'case-evidence',
      'case-evidence',
      false,
      5242880,
      ARRAY['image/png', 'image/jpeg', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Restrictive: blocks anon/authenticated for case-evidence even if other
    -- permissive storage policies would otherwise allow the object.
    EXECUTE 'DROP POLICY IF EXISTS case_evidence_storage_deny_all ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY case_evidence_storage_deny_all
        ON storage.objects
        AS RESTRICTIVE
        FOR ALL
        TO anon, authenticated
        USING (bucket_id <> 'case-evidence')
        WITH CHECK (bucket_id <> 'case-evidence')
    $policy$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
-- DROP POLICY IF EXISTS case_evidence_storage_deny_all ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id = 'case-evidence';
-- DELETE FROM storage.buckets WHERE id = 'case-evidence';
-- DROP TABLE IF EXISTS case_technical_evidence_attachments;
-- DROP TABLE IF EXISTS case_technical_evidence;
-- DROP TYPE IF EXISTS technical_evidence_verification;
-- DROP TYPE IF EXISTS technical_evidence_source;
-- DROP TYPE IF EXISTS technical_evidence_type;
-- ---------------------------------------------------------------------------
-- END 20261121160000_technical_evidence.sql

-- =============================================================================
-- BEGIN 20261121170000_technical_evidence_grants.sql
-- =============================================================================
-- Least-privilege grants for Phase B technical evidence tables.
-- Server-side service_role only; anon/authenticated intentionally have no table access.
-- RLS deny-all policies remain in force for defense in depth.

GRANT USAGE ON TYPE public.technical_evidence_type TO service_role;
GRANT USAGE ON TYPE public.technical_evidence_source TO service_role;
GRANT USAGE ON TYPE public.technical_evidence_verification TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.case_technical_evidence
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.case_technical_evidence_attachments
  TO service_role;

GRANT ALL ON TABLE public.case_technical_evidence TO postgres;
GRANT ALL ON TABLE public.case_technical_evidence_attachments TO postgres;

REVOKE ALL ON TABLE public.case_technical_evidence FROM PUBLIC;
REVOKE ALL ON TABLE public.case_technical_evidence_attachments FROM PUBLIC;
REVOKE ALL ON TABLE public.case_technical_evidence FROM anon, authenticated;
REVOKE ALL ON TABLE public.case_technical_evidence_attachments FROM anon, authenticated;

REVOKE USAGE ON TYPE public.technical_evidence_type FROM PUBLIC;
REVOKE USAGE ON TYPE public.technical_evidence_source FROM PUBLIC;
REVOKE USAGE ON TYPE public.technical_evidence_verification FROM PUBLIC;
REVOKE USAGE ON TYPE public.technical_evidence_type FROM anon, authenticated;
REVOKE USAGE ON TYPE public.technical_evidence_source FROM anon, authenticated;
REVOKE USAGE ON TYPE public.technical_evidence_verification FROM anon, authenticated;
-- END 20261121170000_technical_evidence_grants.sql

-- =============================================================================
-- BEGIN 20261122130000_demo_workspaces_copy_on_write.sql
-- =============================================================================
-- Anonymous demo workspaces + copy-on-write forks
-- Approach D (portfolio interactive demo) — do NOT apply to hosted Supabase without review.
--
-- Dependencies:
--   Phase 2A does NOT require 20261122120000_assessment_versions_and_multi_decisions.sql.
--   This migration applies on top of the existing Phase 7 persistence schema
--   (single analysis / escalation result / decision per case). If assessment
--   versioning is applied later, it remains compatible; clone logic omits
--   versioning columns so it works with or without that migration.
--
-- Goals:
-- - Immutable shared fictional cases (templates: demo_workspace_id IS NULL)
-- - Per-visitor forks scoped by anonymous demo_workspace_id
-- - Simulated decisions distinguishable from organisational approvals
-- - Expiry + cascade cleanup of temporary visitor data
--
-- Clone policy (application-enforced, not DB triggers):
-- - Any shared template MAY be cloned into a visitor workspace, including
--   already-approved templates (e.g. escalated with an Engineering handoff).
-- - Approved templates: the original decision and handoff are copied with new
--   ids and provenance preserved (decided_by, decided_at, rationale;
--   is_simulated = false; handoff.decision_id links to the copied decision).
--   No second approval is recorded or required.
-- - Awaiting-decision templates: visitors may later record a simulated
--   decision on the fork (is_simulated = true).
-- - Copy: case row, analysis, escalation result, technical evidence metadata
--   (attachments are NOT copied; no byte duplication).
-- - Do NOT copy: full event history (a single case_created clone event is
--   written), prior assessment versions, or attachment bytes.
--
-- UI must NOT expose workspace IDs or cloning mechanics.

-- ---------------------------------------------------------------------------
-- demo_workspaces: anonymous visitor isolation (cookie holds id only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_workspaces (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT demo_workspaces_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_demo_workspaces_expires_at
  ON demo_workspaces (expires_at);

COMMENT ON TABLE demo_workspaces IS
  'Anonymous portfolio demo workspaces. Not user accounts. Cookie stores id only.';

-- ---------------------------------------------------------------------------
-- support_cases: template vs fork
-- ---------------------------------------------------------------------------
ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS demo_workspace_id UUID NULL
    REFERENCES demo_workspaces (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cloned_from_case_id UUID NULL
    REFERENCES support_cases (id) ON DELETE SET NULL;

-- Templates (shared fiction): demo_workspace_id IS NULL
-- Forks: demo_workspace_id set; cloned_from_case_id points at template

CREATE INDEX IF NOT EXISTS idx_support_cases_demo_workspace
  ON support_cases (demo_workspace_id)
  WHERE demo_workspace_id IS NOT NULL;

-- At most one fork of a given template per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_cases_workspace_clone_uniq
  ON support_cases (demo_workspace_id, cloned_from_case_id)
  WHERE demo_workspace_id IS NOT NULL
    AND cloned_from_case_id IS NOT NULL;

COMMENT ON COLUMN support_cases.demo_workspace_id IS
  'NULL = shared template (immutable to visitors). Non-NULL = visitor fork.';
COMMENT ON COLUMN support_cases.cloned_from_case_id IS
  'Template case id when this row is a copy-on-write fork.';

-- ---------------------------------------------------------------------------
-- human_decisions: mark simulated visitor approvals
-- ---------------------------------------------------------------------------
ALTER TABLE human_decisions
  ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN;

UPDATE human_decisions
SET is_simulated = false
WHERE is_simulated IS NULL;

ALTER TABLE human_decisions
  ALTER COLUMN is_simulated SET NOT NULL,
  ALTER COLUMN is_simulated SET DEFAULT false;

COMMENT ON COLUMN human_decisions.is_simulated IS
  'true = portfolio visitor simulated decision; false = organisational / seed decision.';

-- ---------------------------------------------------------------------------
-- engineering_handoffs: optional link to the approving decision
-- (still one handoff per case via existing UNIQUE case_id)
-- ---------------------------------------------------------------------------
ALTER TABLE engineering_handoffs
  ADD COLUMN IF NOT EXISTS decision_id UUID NULL
    REFERENCES human_decisions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN;

UPDATE engineering_handoffs
SET is_simulated = false
WHERE is_simulated IS NULL;

ALTER TABLE engineering_handoffs
  ALTER COLUMN is_simulated SET NOT NULL,
  ALTER COLUMN is_simulated SET DEFAULT false;

-- ---------------------------------------------------------------------------
-- Helper: purge expired workspaces (cascade deletes forks + child rows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_demo_workspaces(
  p_now TIMESTAMPTZ DEFAULT now()
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM demo_workspaces
    WHERE expires_at <= p_now
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM deleted;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION purge_expired_demo_workspaces IS
  'Deletes expired anonymous demo workspaces; forks cascade via FK.';

-- Defense in depth: deny PostgREST/anon/authenticated access.
-- App uses the service role (bypasses RLS), matching other Phase 7 tables.
ALTER TABLE demo_workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS demo_workspaces_deny_all ON demo_workspaces;
CREATE POLICY demo_workspaces_deny_all
  ON demo_workspaces
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Rollback considerations (manual, reviewed — do not run casually)
-- ---------------------------------------------------------------------------
-- 0. Restore persist_decision_outcome from 20260907090000_reproduction_fields.sql
--    (before dropping is_simulated / decision_id columns).
-- 1. DELETE FROM demo_workspaces; -- removes all forks via CASCADE
-- 2. DROP FUNCTION IF EXISTS purge_expired_demo_workspaces(TIMESTAMPTZ);
-- 3. ALTER TABLE engineering_handoffs DROP COLUMN IF EXISTS decision_id;
--    ALTER TABLE engineering_handoffs DROP COLUMN IF EXISTS is_simulated;
-- 4. ALTER TABLE human_decisions DROP COLUMN IF EXISTS is_simulated;
-- 5. DROP INDEX IF EXISTS idx_support_cases_workspace_clone_uniq;
--    DROP INDEX IF EXISTS idx_support_cases_demo_workspace;
-- 6. ALTER TABLE support_cases DROP COLUMN IF EXISTS cloned_from_case_id;
--    ALTER TABLE support_cases DROP COLUMN IF EXISTS demo_workspace_id;
-- 7. DROP TABLE IF EXISTS demo_workspaces;
-- Template rows (demo_workspace_id IS NULL) remain untouched if step 1 runs first.

-- ---------------------------------------------------------------------------
-- persist_decision_outcome: also persist is_simulated / decision_id
-- (replaces definition from 20260907090000_reproduction_fields.sql)
-- Requires human_decisions.is_simulated and engineering_handoffs.{is_simulated,decision_id}
-- added above. Does not depend on assessment versioning columns.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION persist_decision_outcome(
  p_case_id UUID,
  p_decision JSONB,
  p_handoff JSONB,
  p_target_status case_status,
  p_events JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event JSONB;
BEGIN
  UPDATE support_cases
  SET
    status = p_target_status,
    updated_at = now()
  WHERE id = p_case_id
    AND status = 'awaiting_decision';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_AWAITING_DECISION'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO human_decisions (
    id,
    case_id,
    decision,
    rationale,
    decided_at,
    decided_by,
    escalation_score_at_decision,
    recommendation_at_decision,
    source,
    is_simulated
  ) VALUES (
    (p_decision->>'id')::uuid,
    p_case_id,
    (p_decision->>'decision')::human_decision_type,
    p_decision->>'rationale',
    (p_decision->>'decidedAt')::timestamptz,
    p_decision->>'decidedBy',
    (p_decision->>'escalationScoreAtDecision')::integer,
    (p_decision->>'recommendationAtDecision')::escalation_recommendation,
    COALESCE(p_decision->>'source', 'human_decision'),
    COALESCE((p_decision->>'isSimulated')::boolean, false)
  );

  IF p_handoff IS NOT NULL THEN
    INSERT INTO engineering_handoffs (
      id,
      case_id,
      title,
      summary,
      customer_impact,
      environment,
      reported_severity,
      affected_customer_count,
      issue_category,
      steps_to_reproduce,
      expected_behaviour,
      actual_behaviour,
      reproducibility,
      troubleshooting_performed,
      evidence,
      missing_evidence,
      suspected_root_cause,
      escalation_score,
      escalation_recommendation,
      decision_rationale,
      created_at,
      source,
      is_simulated,
      decision_id
    ) VALUES (
      (p_handoff->>'id')::uuid,
      p_case_id,
      p_handoff->>'title',
      p_handoff->>'summary',
      p_handoff->>'customerImpact',
      p_handoff->>'environment',
      (p_handoff->>'reportedSeverity')::severity,
      NULLIF(p_handoff->>'affectedCustomerCount', '')::integer,
      p_handoff->>'issueCategory',
      COALESCE(NULLIF(p_handoff->>'stepsToReproduce', ''), 'Not provided'),
      COALESCE(NULLIF(p_handoff->>'expectedBehaviour', ''), 'Not provided'),
      COALESCE(NULLIF(p_handoff->>'actualBehaviour', ''), 'Not provided'),
      p_handoff->>'reproducibility',
      p_handoff->>'troubleshootingPerformed',
      COALESCE(p_handoff->'evidence', '[]'::jsonb),
      COALESCE(p_handoff->'missingEvidence', '[]'::jsonb),
      p_handoff->>'suspectedRootCause',
      (p_handoff->>'escalationScore')::integer,
      (p_handoff->>'escalationRecommendation')::escalation_recommendation,
      p_handoff->>'decisionRationale',
      (p_handoff->>'createdAt')::timestamptz,
      COALESCE(p_handoff->>'source', 'engineering_handoff'),
      COALESCE((p_handoff->>'isSimulated')::boolean, false),
      NULLIF(p_handoff->>'decisionId', '')::uuid
    );
  END IF;

  FOR v_event IN SELECT * FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb))
  LOOP
    INSERT INTO case_events (id, case_id, event_type, metadata, created_at)
    VALUES (
      (v_event->>'id')::uuid,
      p_case_id,
      v_event->>'eventType',
      v_event->'metadata',
      (v_event->>'createdAt')::timestamptz
    );
  END LOOP;
END;
$$;
-- END 20261122130000_demo_workspaces_copy_on_write.sql

-- =============================================================================
-- BEGIN 20261122140000_demo_downstream_records.sql
-- =============================================================================
-- Phase 2B: persistent simulated Jira / Rootly records for anonymous workspaces
-- Depends on: 20261122130000_demo_workspaces_copy_on_write.sql
-- Do NOT apply to hosted Supabase without review.
--
-- One simulated record per destination per case per workspace.
-- Cascades when the workspace or fork case is deleted.

CREATE TABLE IF NOT EXISTS demo_downstream_records (
  id UUID PRIMARY KEY,
  demo_workspace_id UUID NOT NULL
    REFERENCES demo_workspaces (id) ON DELETE CASCADE,
  case_id UUID NOT NULL
    REFERENCES support_cases (id) ON DELETE CASCADE,
  destination TEXT NOT NULL
    CHECK (destination IN ('jira', 'rootly')),
  external_reference TEXT NOT NULL,
  payload JSONB NOT NULL,
  handoff_id UUID NULL
    REFERENCES engineering_handoffs (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT demo_downstream_records_reference_len
    CHECK (char_length(external_reference) BETWEEN 1 AND 80)
);

-- Idempotency: one Jira and one Rootly per case per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_downstream_workspace_case_dest
  ON demo_downstream_records (demo_workspace_id, case_id, destination);

CREATE INDEX IF NOT EXISTS idx_demo_downstream_workspace
  ON demo_downstream_records (demo_workspace_id);

CREATE INDEX IF NOT EXISTS idx_demo_downstream_case
  ON demo_downstream_records (case_id);

COMMENT ON TABLE demo_downstream_records IS
  'Simulated Jira/Rootly demo records scoped to anonymous workspaces. Not external tickets.';

COMMENT ON COLUMN demo_downstream_records.external_reference IS
  'Deterministic demo reference (ENG-DEMO-* or INC-DEMO-*). Not a live issue key.';

COMMENT ON COLUMN demo_downstream_records.payload IS
  'Server-built preview/result JSON used for refresh display. Never client-authored.';

-- Defense in depth: deny PostgREST/anon/authenticated access.
-- App uses the service role (bypasses RLS), matching other Phase 7 tables.
ALTER TABLE demo_downstream_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS demo_downstream_records_deny_all ON demo_downstream_records;
CREATE POLICY demo_downstream_records_deny_all
  ON demo_downstream_records
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Rollback (manual, reviewed)
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS demo_downstream_records_deny_all ON demo_downstream_records;
-- DROP INDEX IF EXISTS idx_demo_downstream_case;
-- DROP INDEX IF EXISTS idx_demo_downstream_workspace;
-- DROP INDEX IF EXISTS idx_demo_downstream_workspace_case_dest;
-- DROP TABLE IF EXISTS demo_downstream_records;
-- END 20261122140000_demo_downstream_records.sql

