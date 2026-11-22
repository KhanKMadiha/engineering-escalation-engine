# Phase 2C — deployment readiness (do not deploy from this note alone)

## Migration order

1. `20261122130000_demo_workspaces_copy_on_write.sql`
2. `20261122140000_demo_downstream_records.sql`

`20261122120000_assessment_versions_and_multi_decisions.sql` is **not** required for Phase 2A/2B.

## Hosted coexistence

- Existing fictional `support_cases` rows remain templates (`demo_workspace_id IS NULL`).
- Historical decisions/handoffs/analyses are unchanged by the new tables.
- Additive columns only (`demo_workspace_id`, `cloned_from_case_id`, `is_simulated`, `decision_id`).
- App `listCases` falls back if `demo_workspace_id` is missing (pre-migration).

## Cleanup schedule (hosted)

After migrations are applied, schedule (not on visitor requests):

```sql
SELECT purge_expired_demo_workspaces(now());
```

Recommended: hourly or daily via Supabase `pg_cron` or a privileged platform cron.
Cascades: visitor forks + `demo_downstream_records`.

## Secrets

- Set `DEMO_WORKSPACE_SECRET` to a long random value in the hosted environment only.
- Never use `NEXT_PUBLIC_*` for this secret or `SUPABASE_SERVICE_ROLE_KEY`.
- Local `.env.local` must not point write tooling at production when applying migrations.

## Controlled deployment sequence

1. Provision / confirm an **isolated** staging Supabase project (not production).
2. Apply `130000` then `140000` on staging; run `RUN_SUPABASE_INTEGRATION=1` tests.
3. Set `DEMO_WORKSPACE_SECRET` on staging; smoke Orchid approve → Jira/Rootly.
4. Apply the same migrations to hosted production during a maintenance window.
5. Set production `DEMO_WORKSPACE_SECRET`; verify cookie Secure + httpOnly.
6. Enable purge cron; confirm templates unchanged and Orchid remains the only ordinary pending approval.
7. Monitor error logs for clone/unique-constraint races.

## Isolated DB limitation → Phase 3A

Live database verification is tracked in
[`PHASE-3A-STAGING-VERIFICATION.md`](./PHASE-3A-STAGING-VERIFICATION.md).

- No local Supabase CLI / Docker on the verification workstation.
- `.env.local` may point at production ref `zfpakilfxnwhlcfjgemw` — leave it alone; use `.env.staging` instead.
- Run: `npm run test:supabase:staging` after `.env.staging` exists.
- Memory-repo + mocked PostgREST tests are **not** a substitute for staging DB verification before production apply.
