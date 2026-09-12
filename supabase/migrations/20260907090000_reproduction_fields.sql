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
