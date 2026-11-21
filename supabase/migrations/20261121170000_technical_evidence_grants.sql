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
