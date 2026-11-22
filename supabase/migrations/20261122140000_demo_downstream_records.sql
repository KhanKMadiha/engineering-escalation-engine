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
