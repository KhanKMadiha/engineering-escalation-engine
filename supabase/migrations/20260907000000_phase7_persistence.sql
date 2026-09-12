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
