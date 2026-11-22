# Phase 3B — production migration and release readiness

**Branch:** `feature/assessment-redesign`  
**Status:** readiness review only — **do not apply, merge, or deploy from this note alone**  
**Production ref:** `zfpakilfxnwhlcfjgemw`  
**Staging ref (verified Phase 3A):** `mmebhgkpylaxqvtjrvyt`

---

## 1. Staging-versus-production compatibility

### Schema

| Object | Staging | Production (read-only probe) |
|--------|---------|------------------------------|
| Core Phase 7 tables | Present | Present |
| `support_cases.demo_workspace_id` / `cloned_from_case_id` | Present | **Absent** (`42703`) |
| `human_decisions.is_simulated` | Present | **Absent** |
| `engineering_handoffs.is_simulated` / `decision_id` | Present | **Absent** |
| `demo_workspaces` | Present | **Absent** (`PGRST205`) |
| `demo_downstream_records` | Present | **Absent** |
| `purge_expired_demo_workspaces` | Present | **Absent** |
| `assessment_version` / `is_current` | **Absent** (intentionally skipped) | **Absent** |

Conclusion: production is still on the pre-CoW schema. Staging matches the intended production end-state for Phase 2A/2B **without** assessment versioning.

### Fictional cases (production)

Exactly **10** `[DEMO]` templates remain intact:

| Case | Status | Recommendation |
|------|--------|----------------|
| Orchid Health | `awaiting_decision` | escalate |
| Meridian Systems | `investigation_continues` | insufficient_evidence |
| Summit Workforce | `investigation_continues` | insufficient_evidence |
| Vertex Media | `escalated` | escalate (corrected rationale present) |
| Northstar / Helix / Cascade | `escalated` | escalate |
| Apex / Blue Harbor / Brightline | `investigation_continues` | continue_investigation |

No peak-load language in customer title/description fields on production probe.

Staging also has Phase 3A probe rows (expected); production does not — do not copy staging data into production.

### RLS / grants

- Staging: fresh project + SQL advisor “Run and enable RLS” required a follow-up grants script for `service_role`.
- Production: `service_role` already reads/writes existing Phase 7 tables successfully today.
- CoW migrations add **deny-all RLS** on `demo_workspaces` and `demo_downstream_records` but do **not** grant `service_role` on those new tables. Production will need the **minimal** grants file (below), not the broad staging grants file.

### Migration safety for existing records

`130000` + `140000` are additive:

- New tables + nullable columns + backfill `is_simulated = false` for existing decisions/handoffs
- Unique indexes only constrain visitor forks / downstream rows
- No DELETE/UPDATE of fictional case content
- `persist_decision_outcome` is replaced to accept `is_simulated` / `decision_id` (compatible with current app)

`120000` (assessment versioning) is **not** required and must stay out of this release.

---

## 2. Service-role permissions review

### Why staging needed `phase3a-service-role-grants.sql`

Supabase SQL Editor warned about missing RLS on a greenfield schema. Choosing “Run and enable RLS” enabled RLS broadly and left core tables without usable `service_role` table privileges (`42501 permission denied`). The staging grants script restored access.

### What that staging script does (too broad for production)

- `GRANT` on **all** core + new tables to `service_role`
- `REVOKE` from `PUBLIC` / `anon` / `authenticated` on core tables
- `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public`
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on legacy core tables

### Production recommendation

Use only:

`supabase/production/phase3b-service-role-grants-minimal.sql`

It grants `service_role` on **new** objects only:

- `demo_workspaces`
- `demo_downstream_records`
- `purge_expired_demo_workspaces(...)`
- `persist_decision_outcome` (re-affirmed after 130000 replaces it)

It does **not** enable RLS on legacy tables, does **not** revoke core-table privileges, and does **not** grant execute on every public function.

### Ownership enforcement (unchanged)

Application layer continues to enforce isolation:

- Signed httpOnly cookie (`eee_demo_workspace`)
- `assertWorkspaceOwnsCase` / `assertCaseReadableByWorkspace`
- Soft eligibility before workspace creation (Meridian)
- Server-built downstream payloads; client cannot supply fabricated approvals

DB uniqueness backs this up: one fork per `(workspace, template)`, one downstream row per `(workspace, case, destination)`.

---

## 3. Production migration plan

### Order (approved SQL only)

1. Confirm backups (section 4) — **stop if unverified**
2. Run read-only preflight: `node scripts/production-preflight.mjs`
3. Apply `supabase/migrations/20261122130000_demo_workspaces_copy_on_write.sql`
4. Apply `supabase/migrations/20261122140000_demo_downstream_records.sql`
5. Apply `supabase/production/phase3b-service-role-grants-minimal.sql`
6. Re-run preflight; confirm CoW objects present and ten demos unchanged
7. Configure `DEMO_WORKSPACE_SECRET` + purge schedule (section 5)
8. Deploy application build that contains CoW/downstream code
9. Smoke-test (section 6)

### Preflight

```bash
node scripts/production-preflight.mjs
# writes docs/lifecycle-phase1-nov2026/phase3b-production-preflight-latest.json
```

Refuses to run unless `SUPABASE_URL` resolves to `zfpakilfxnwhlcfjgemw`. Read-only.

### Rollback considerations (migrations)

Manual, reviewed (from migration comments):

1. Prefer **application feature flag / env rollback** first (point app at memory or disable interactive writes) rather than dropping columns while visitors exist.
2. `DELETE FROM demo_workspaces;` cascades forks + downstream rows; **templates remain**.
3. Drop new tables/columns/functions only after visitor data is expendable.
4. Restoring `persist_decision_outcome` from `20260907090000_reproduction_fields.sql` if the CoW RPC must be reverted.

Avoid destructive rollback that deletes `support_cases` templates or historical decisions.

---

## 4. Backup and recovery (verified guidance, plan-dependent)

Per [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups):

| Plan | Automatic backups | PITR |
|------|-------------------|------|
| Free | **None** — manual `supabase db dump` only | No |
| Pro | Daily, 7-day retention (Dashboard → Database → Backups) | Paid add-on |
| Team / Enterprise | Longer retention | Add-on |

**This review cannot claim a usable automatic backup exists** until someone confirms the production project’s plan and that **Database → Backups** lists a recent restore point.

### Required before any production write

1. Open production project `zfpakilfxnwhlcfjgemw` → **Project Settings / Billing** → note plan.
2. Open **Database → Backups** → confirm a restore point exists **or** take a manual logical dump off-site.
3. Record backup timestamp in the release checklist.

If Free / no backup: **do not migrate** until a verified dump or plan upgrade exists.

### If an issue occurs after migrate

1. Stop interactive writes: unset/rotate `DEMO_WORKSPACE_SECRET` or set `CASE_REPOSITORY=memory` temporarily on the host (shared templates become read-only/in-memory depending on wiring) — prefer a short maintenance page / feature freeze over schema surgery.
2. Preserve templates: never `DELETE` from `support_cases` where `demo_workspace_id IS NULL`.
3. Visitor forks only: `DELETE FROM demo_workspaces WHERE …` or wait for purge.
4. Full restore: Dashboard backup restore (downtime; replaces DB state) — only if verified available; prefer restore-to-new-project then cut over if current data must be inspected.

---

## 5. Environment and cleanup

### Secrets / cookies

| Item | Requirement |
|------|-------------|
| `DEMO_WORKSPACE_SECRET` | Long random value in **production host env only** (Vercel/host secrets). Never `NEXT_PUBLIC_*`. |
| Cookie `eee_demo_workspace` | `httpOnly: true`, `secure: true` when `NODE_ENV=production`, `sameSite: 'lax'`, 48h expiry |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; unchanged pattern |

Do **not** configure production secrets from this phase.

### Purge schedule

```sql
SELECT purge_expired_demo_workspaces(now());
```

- Scope: expired `demo_workspaces` only → cascades private forks + `demo_downstream_records`
- Shared templates (`demo_workspace_id IS NULL`) are **not** deleted
- Recommend: hourly via Supabase `pg_cron` or a privileged platform cron (not visitor requests)
- Monitor: purge return count + app error logs for unique-constraint races

---

## 6. Production smoke-test checklist

Limit writes to **new anonymous workspaces** created during the test. Do not mutate templates.

- [ ] Case Queue loads; ten fictional customers visible
- [ ] Orchid: approve → redirect to private fork; template stays `awaiting_decision`
- [ ] Orchid fork: Create Jira (preview → confirm) → success copy; refresh persists
- [ ] Orchid fork: Create Rootly → success copy; refresh persists
- [ ] Meridian: Investigation Continues; no Approve; no Jira/Rootly
- [ ] Vertex: corrected approval rationale visible; Create escalation works via CoW without second approval; template `is_simulated` remains false
- [ ] Second browser/session cannot open first visitor’s fork URL (404 / not available)
- [ ] `DEMO_WORKSPACE_SECRET` set; cookie Secure+httpOnly in production
- [ ] Purge job configured (or explicitly deferred with owner sign-off)

---

## 7. Remaining blockers and recommended release order

### Blockers requiring a decision

1. **Backup verification** — confirm Pro (or better) daily backup **or** completed off-site dump before applying SQL.
2. **Host secret** — who sets `DEMO_WORKSPACE_SECRET` in production, and when relative to app deploy.
3. **Purge cron ownership** — enable at cutover vs defer (visitor data can accumulate for 48h without purge, but should not ship without a plan).
4. **Deploy sequencing** — migrate DB **before** or **with** app deploy: app already tolerates missing `demo_workspace_id` (listCases fallback), but interactive CoW requires migrations + grants + secret.

### Recommended release order

1. Verify backups  
2. Preflight JSON baseline  
3. Apply `130000` → `140000` → minimal grants (maintenance window)  
4. Preflight confirm + spot-check ten demos  
5. Set `DEMO_WORKSPACE_SECRET`  
6. Deploy app  
7. Smoke checklist  
8. Enable purge cron  
9. Monitor 24–48h  

### Security / data-integrity risks

| Risk | Mitigation |
|------|------------|
| Broad staging grants re-run on prod | Use **minimal** grants only |
| Applying `120000` by mistake | Explicitly excluded; preflight checks assessment columns absent/present |
| Concurrent fork races | Unique index + app reuse path (verified on staging) |
| Accidental template mutation | App immutability checks + soft eligibility |
| Restore wipes post-migrate visitor data | Expected; templates recoverable from backup if backup exists |

---

## Static checks (this phase)

No production writes. Artifacts added under `docs/lifecycle-phase1-nov2026/`, `supabase/production/`, `scripts/production-preflight.mjs`.
