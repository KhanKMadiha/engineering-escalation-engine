# Phase 3A — isolated Supabase staging verification

**Status:** staging verification completed on project ref `mmebhgkpylaxqvtjrvyt` (`engineering-escalation-staging`).  
**Branch:** `feature/assessment-redesign`  
**Protected production ref:** `zfpakilfxnwhlcfjgemw` — left untouched.

## Assessment versioning migration (`20261122120000`)

**Not required for Phase 3A staging.**

- CoW migrations `130000` / `140000` explicitly do not depend on it.
- Repository clone/save paths strip `assessment_version` / `is_current` so writes match the current production-shaped schema.
- Skip `20261122120000_assessment_versions_and_multi_decisions.sql` on staging unless you intentionally want to test that separate feature.

## Exact setup (human action required)

### A. Create an isolated Supabase project

1. Open [Supabase dashboard](https://supabase.com/dashboard) → project **`engineering-escalation-staging`**.
2. Confirm the project URL host is **not** `zfpakilfxnwhlcfjgemw.supabase.co`.

### B. Fill `.env.staging` (do not paste secrets into chat)

A gitignored `.env.staging` scaffold already exists with a local `DEMO_WORKSPACE_SECRET`.

1. In Supabase: **Project Settings → API**.
2. Copy **Project URL** into `SUPABASE_URL=` in `.env.staging`.
3. Under **Project API keys**, copy the **`service_role`** key (secret) into `SUPABASE_SERVICE_ROLE_KEY=`.  
   - Use **service_role**, not `anon`.  
   - Never put this in `NEXT_PUBLIC_*`.
4. Leave `DEMO_WORKSPACE_SECRET` as generated (or replace with your own long random value).
5. Save the file. Reply in chat with only: **staging env ready** (no secrets).

### C. Apply migrations (staging SQL editor only — after env is verified)

Run **in filename order** from `supabase/migrations/` (**skip** `20261122120000`):

1. `20260907000000_phase7_persistence.sql`
2. `20260907090000_reproduction_fields.sql`
3. `20260911120000_issue_first_observed.sql`
4. `20261120120000_ticket_import_fields.sql`
5. `20261121160000_technical_evidence.sql`
6. `20261121170000_technical_evidence_grants.sql`
7. `20261122130000_demo_workspaces_copy_on_write.sql` ← Phase 2A
8. `20261122140000_demo_downstream_records.sql` ← Phase 2B

**Do not** run these against production from this machine.

### D. Verify project identity before any write test

```bash
node -e "const u=process.env.SUPABASE_URL; const r=new URL(u).hostname.split('.')[0]; if(r==='zfpakilfxnwhlcfjgemw') process.exit(1); console.log('staging ref ok:', r)"
```

(Load vars from `.env.staging` in your shell first; do not print the service role key.)

### E. Run Phase 3A live tests

```bash
npm run test:supabase:staging
```

This script:

- loads **only** `.env.staging` (not `.env.local`)
- refuses production ref `zfpakilfxnwhlcfjgemw`
- sets `RUN_SUPABASE_INTEGRATION=1`
- runs `tests/demo/phase3a-supabase-staging.test.ts` plus related opt-in suites

Optional fictional seed against staging (after migrations):

```bash
env $(grep -v '^#' .env.staging | xargs) ALLOW_DEMO_SEED=1 npm run seed:demo
```

### F. Browser E2E (optional second step)

Database integration does **not** require a staging app deploy.  
Browser E2E needs a separate staging app instance pointed at `.env.staging` (e.g. `env $(grep -v '^#' .env.staging | xargs) npm run dev` on a free port). Until that exists, report browser coverage as a remaining gap.

## What the live suite verifies

- Schema: `demo_workspaces`, `demo_downstream_records`, fork columns, `is_simulated`, purge RPC
- Cookie sign / verify / tamper / expiry (`DEMO_WORKSPACE_SECRET`)
- Orchid-like: CoW fork, simulated approval + handoff, Jira/Rootly persistence + idempotency, template unchanged
- Vertex-like: organisational approval provenance on fork; corrected rationale; historical AI inference preserved as inference
- Meridian-like: approval + downstream rejected; template unchanged
- Cross-workspace isolation + unique fork constraint
- `purge_expired_demo_workspaces` cascade (forks + downstream); templates retained

## Production cleanup schedule (after a future production migrate — not Phase 3A)

```sql
SELECT purge_expired_demo_workspaces(now());
```

Recommend hourly or daily via Supabase `pg_cron` or a privileged platform cron. Monitor purge count and error logs. Never invoke purge from anonymous visitor requests. Never run purge against production during Phase 3A.

## After staging is ready

Re-run this Phase 3A checklist and stop again for review before any production migration or app deploy.
