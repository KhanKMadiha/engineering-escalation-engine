-- Phase 3A staging only (engineering-escalation-staging / mmebhgkpylaxqvtjrvyt)
-- Do NOT run against production zfpakilfxnwhlcfjgemw.
--
-- After Supabase "Run and enable RLS", table privileges for service_role may be
-- missing. The app uses service_role exclusively (bypasses RLS). Grant access
-- here; keep anon/authenticated without table privileges.

GRANT USAGE ON SCHEMA public TO service_role;

-- Enums / types used by inserts
DO $$ BEGIN
  GRANT USAGE ON TYPE public.case_status TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.severity TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.environment TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.escalation_recommendation TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.human_decision_type TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.technical_evidence_type TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.technical_evidence_source TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON TYPE public.technical_evidence_verification TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.case_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.escalation_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.human_decisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.engineering_handoffs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.case_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demo_workspaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demo_downstream_records TO service_role;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.case_technical_evidence TO service_role;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.case_technical_evidence_attachments TO service_role;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

GRANT ALL ON TABLE public.support_cases TO postgres;
GRANT ALL ON TABLE public.case_analyses TO postgres;
GRANT ALL ON TABLE public.escalation_results TO postgres;
GRANT ALL ON TABLE public.human_decisions TO postgres;
GRANT ALL ON TABLE public.engineering_handoffs TO postgres;
GRANT ALL ON TABLE public.case_events TO postgres;
GRANT ALL ON TABLE public.demo_workspaces TO postgres;
GRANT ALL ON TABLE public.demo_downstream_records TO postgres;

REVOKE ALL ON TABLE public.support_cases FROM PUBLIC;
REVOKE ALL ON TABLE public.case_analyses FROM PUBLIC;
REVOKE ALL ON TABLE public.escalation_results FROM PUBLIC;
REVOKE ALL ON TABLE public.human_decisions FROM PUBLIC;
REVOKE ALL ON TABLE public.engineering_handoffs FROM PUBLIC;
REVOKE ALL ON TABLE public.case_events FROM PUBLIC;
REVOKE ALL ON TABLE public.demo_workspaces FROM PUBLIC;
REVOKE ALL ON TABLE public.demo_downstream_records FROM PUBLIC;

REVOKE ALL ON TABLE public.support_cases FROM anon, authenticated;
REVOKE ALL ON TABLE public.case_analyses FROM anon, authenticated;
REVOKE ALL ON TABLE public.escalation_results FROM anon, authenticated;
REVOKE ALL ON TABLE public.human_decisions FROM anon, authenticated;
REVOKE ALL ON TABLE public.engineering_handoffs FROM anon, authenticated;
REVOKE ALL ON TABLE public.case_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.demo_workspaces FROM anon, authenticated;
REVOKE ALL ON TABLE public.demo_downstream_records FROM anon, authenticated;

-- Functions used by the repository (signatures may vary slightly by migration).
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Ensure RLS remains on for defense in depth (service_role bypasses RLS).
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engineering_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_downstream_records ENABLE ROW LEVEL SECURITY;
