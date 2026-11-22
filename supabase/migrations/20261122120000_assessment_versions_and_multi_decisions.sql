-- Assessment versioning + multiple human decisions
-- Part of Approach D foundation — do NOT apply to hosted/production Supabase without review.
-- Apply before 20261122130000_demo_workspaces_copy_on_write.sql
--
-- Goals:
-- - Preserve every prior analysis + escalation result (versioned, is_current)
-- - Allow multiple human_decisions per case linked to assessment_version
-- - Support exception approvals with explicit exception_reason
-- - Keep a single engineering_handoff per case
-- - Replace persist_decision_outcome with a multi-decision-safe v2 RPC
--
-- Rollback notes (manual, reviewed):
-- - Prefer leaving history intact and pointing app code at is_current only
-- - Destructive rollback would require collapsing to one row per case before
--   restoring UNIQUE(case_id) constraints — do not run casually

-- ---------------------------------------------------------------------------
-- support_cases: current assessment pointer + reassessment fingerprint
-- ---------------------------------------------------------------------------
ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS current_assessment_version INTEGER NULL,
  ADD COLUMN IF NOT EXISTS assessment_input_fingerprint TEXT NULL;

-- ---------------------------------------------------------------------------
-- case_analyses: versioned history
-- ---------------------------------------------------------------------------
ALTER TABLE case_analyses
  ADD COLUMN IF NOT EXISTS assessment_version INTEGER,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN;

UPDATE case_analyses
SET
  assessment_version = 1,
  is_current = true
WHERE assessment_version IS NULL;

ALTER TABLE case_analyses
  ALTER COLUMN assessment_version SET NOT NULL,
  ALTER COLUMN assessment_version SET DEFAULT 1,
  ALTER COLUMN is_current SET NOT NULL,
  ALTER COLUMN is_current SET DEFAULT true;

ALTER TABLE case_analyses
  DROP CONSTRAINT IF EXISTS case_analyses_case_id_key;

ALTER TABLE case_analyses
  DROP CONSTRAINT IF EXISTS case_analyses_case_id_assessment_version_key;

ALTER TABLE case_analyses
  ADD CONSTRAINT case_analyses_case_id_assessment_version_key
  UNIQUE (case_id, assessment_version);

DROP INDEX IF EXISTS case_analyses_one_current_per_case;
CREATE UNIQUE INDEX case_analyses_one_current_per_case
  ON case_analyses (case_id)
  WHERE is_current;

-- ---------------------------------------------------------------------------
-- escalation_results: versioned history (paired with analysis version)
-- ---------------------------------------------------------------------------
ALTER TABLE escalation_results
  ADD COLUMN IF NOT EXISTS assessment_version INTEGER,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN;

UPDATE escalation_results
SET
  assessment_version = 1,
  is_current = true
WHERE assessment_version IS NULL;

ALTER TABLE escalation_results
  ALTER COLUMN assessment_version SET NOT NULL,
  ALTER COLUMN assessment_version SET DEFAULT 1,
  ALTER COLUMN is_current SET NOT NULL,
  ALTER COLUMN is_current SET DEFAULT true;

ALTER TABLE escalation_results
  DROP CONSTRAINT IF EXISTS escalation_results_case_id_key;

ALTER TABLE escalation_results
  DROP CONSTRAINT IF EXISTS escalation_results_case_id_assessment_version_key;

ALTER TABLE escalation_results
  ADD CONSTRAINT escalation_results_case_id_assessment_version_key
  UNIQUE (case_id, assessment_version);

DROP INDEX IF EXISTS escalation_results_one_current_per_case;
CREATE UNIQUE INDEX escalation_results_one_current_per_case
  ON escalation_results (case_id)
  WHERE is_current;

-- Align support_cases.current_assessment_version from existing current rows
UPDATE support_cases sc
SET current_assessment_version = ca.assessment_version
FROM case_analyses ca
WHERE ca.case_id = sc.id
  AND ca.is_current = true
  AND sc.current_assessment_version IS NULL;

-- ---------------------------------------------------------------------------
-- human_decisions: multiple decisions + exception fields
-- ---------------------------------------------------------------------------
ALTER TABLE human_decisions
  ADD COLUMN IF NOT EXISTS assessment_version INTEGER,
  ADD COLUMN IF NOT EXISTS is_exception BOOLEAN,
  ADD COLUMN IF NOT EXISTS exception_reason TEXT;

UPDATE human_decisions
SET
  assessment_version = 1,
  is_exception = false
WHERE assessment_version IS NULL;

ALTER TABLE human_decisions
  ALTER COLUMN assessment_version SET NOT NULL,
  ALTER COLUMN assessment_version SET DEFAULT 1,
  ALTER COLUMN is_exception SET NOT NULL,
  ALTER COLUMN is_exception SET DEFAULT false;

ALTER TABLE human_decisions
  DROP CONSTRAINT IF EXISTS human_decisions_case_id_key;

ALTER TABLE human_decisions
  DROP CONSTRAINT IF EXISTS human_decisions_exception_reason_check;

ALTER TABLE human_decisions
  ADD CONSTRAINT human_decisions_exception_reason_check
  CHECK (
    is_exception = false
    OR (
      exception_reason IS NOT NULL
      AND length(trim(exception_reason)) >= 20
    )
  );

CREATE INDEX IF NOT EXISTS idx_human_decisions_case_decided_at
  ON human_decisions (case_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_human_decisions_case_assessment_version
  ON human_decisions (case_id, assessment_version);

-- ---------------------------------------------------------------------------
-- persist_decision_outcome_v2: multi-decision, stale version, one handoff
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION persist_decision_outcome_v2(
  p_case_id UUID,
  p_decision JSONB,
  p_handoff JSONB,
  p_target_status case_status,
  p_events JSONB,
  p_expected_assessment_version INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event JSONB;
  v_current_version INTEGER;
  v_is_exception BOOLEAN;
BEGIN
  SELECT current_assessment_version
  INTO v_current_version
  FROM support_cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_version IS DISTINCT FROM p_expected_assessment_version THEN
    RAISE EXCEPTION 'STALE_ASSESSMENT'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_exception := COALESCE((p_decision->>'isException')::boolean, false);

  -- Ordinary approvals remain from awaiting_decision.
  -- Exception approvals may proceed from investigation_continues or awaiting_decision.
  IF v_is_exception THEN
    UPDATE support_cases
    SET
      status = p_target_status,
      updated_at = now()
    WHERE id = p_case_id
      AND status IN ('awaiting_decision', 'investigation_continues');
  ELSE
    UPDATE support_cases
    SET
      status = p_target_status,
      updated_at = now()
    WHERE id = p_case_id
      AND status = 'awaiting_decision';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_ELIGIBLE_FOR_DECISION'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_handoff IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM engineering_handoffs WHERE case_id = p_case_id
    ) THEN
      RAISE EXCEPTION 'HANDOFF_ALREADY_EXISTS'
        USING ERRCODE = 'P0001';
    END IF;
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
    assessment_version,
    is_exception,
    exception_reason
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
    COALESCE((p_decision->>'assessmentVersion')::integer, p_expected_assessment_version),
    v_is_exception,
    NULLIF(p_decision->>'exceptionReason', '')
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

COMMENT ON FUNCTION persist_decision_outcome_v2 IS
  'Increment 2+: multi-decision persist with stale assessment guard and single handoff. Prefer over persist_decision_outcome after migration review.';
