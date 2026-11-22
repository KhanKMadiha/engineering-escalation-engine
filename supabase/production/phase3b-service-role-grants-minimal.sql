-- Phase 3B — minimum safe production grants for CoW / downstream tables.
-- Target: production project zfpakilfxnwhlcfjgemw ONLY after 130000 + 140000.
-- Do NOT apply until production migration is approved.
--
-- Why this is narrower than staging/phase3a-service-role-grants.sql:
-- Staging needed broad grants because "Run and enable RLS" on a fresh project
-- left core tables without service_role privileges. Production already serves
-- the ten fictional cases via service_role today — do not re-touch core table
-- privileges, do not enable RLS on legacy tables, and do not
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public.

-- New tables created by Phase 2A/2B migrations (RLS deny-all already in those SQL files).
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demo_workspaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demo_downstream_records TO service_role;

GRANT ALL ON TABLE public.demo_workspaces TO postgres;
GRANT ALL ON TABLE public.demo_downstream_records TO postgres;

REVOKE ALL ON TABLE public.demo_workspaces FROM PUBLIC;
REVOKE ALL ON TABLE public.demo_downstream_records FROM PUBLIC;
REVOKE ALL ON TABLE public.demo_workspaces FROM anon, authenticated;
REVOKE ALL ON TABLE public.demo_downstream_records FROM anon, authenticated;

-- Purge helper introduced by 20261122130000.
GRANT EXECUTE ON FUNCTION public.purge_expired_demo_workspaces(timestamptz) TO service_role;

-- persist_decision_outcome is replaced by 130000 to accept is_simulated / decision_id.
-- Re-affirm execute for service_role without granting every public function.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'persist_decision_outcome'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
