# Phase 2A — anonymous workspace expiry and cleanup

## Policy

- Anonymous demo workspaces expire **48 hours** after creation (`expires_at`).
- Cookie signing uses the same expiry (`eee_demo_workspace`).
- Expired workspaces and all private forks cascade via
  `support_cases.demo_workspace_id → demo_workspaces(id) ON DELETE CASCADE`.
- Phase 2B simulated Jira/Rootly rows cascade via
  `demo_downstream_records.demo_workspace_id → demo_workspaces(id) ON DELETE CASCADE`.

## Application helpers

- `CaseRepository.purgeExpiredDemoWorkspaces(nowIso?)`
  - In-memory: deletes workspace rows and forked cases/evidence metadata.
  - Supabase: calls `purge_expired_demo_workspaces(p_now)`.

## Hosted scheduling (do not run on ordinary visitor requests)

Preferred options after the CoW migration is applied:

1. **Supabase scheduled function / pg_cron** (recommended)
   ```sql
   SELECT purge_expired_demo_workspaces(now());
   ```
   Schedule hourly or daily.

2. **Platform cron** (Vercel Cron / GitHub Action) calling a **privileged**
   admin-only route or CLI that uses the service role key.
   - Must not be reachable without auth.
   - Must not be triggered by anonymous page views.

Ordinary Server Actions and API reads/writes must **not** call global purge.

## Local verification

```ts
await repository.purgeExpiredDemoWorkspaces(new Date().toISOString());
```
