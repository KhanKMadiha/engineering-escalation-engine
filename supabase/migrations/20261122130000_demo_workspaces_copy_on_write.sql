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
