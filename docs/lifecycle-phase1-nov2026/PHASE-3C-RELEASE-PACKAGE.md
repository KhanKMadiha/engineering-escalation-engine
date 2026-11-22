# Phase 3C — final release package

**Branch:** `feature/assessment-redesign`  
**Status:** package prepared — **STOP for approval before any production write, merge, or deploy**  
**Prepared:** 2026-11-22  
**Production ref:** `zfpakilfxnwhlcfjgemw`  
**Staging ref (Phase 3A verified):** `mmebhgkpylaxqvtjrvyt` (`engineering-escalation-staging`)

This document is the Phase 3C release package. It does **not** authorize execution.

---

## 1. Final release verification

| Check | Result |
|-------|--------|
| Production project ref | `zfpakilfxnwhlcfjgemw` (`.env.local` + preflight) |
| Staging project ref | `mmebhgkpylaxqvtjrvyt` (`.env.staging` + Phase 3A docs) |
| Official backup present | `~/Madiha/Backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22/` |
| Backup checksums | All `MANIFEST.json` SHA-256 entries re-verified **OK** |
| Logical app-data export | `logical-service-role/MANIFEST.json` `passed: true` (10 demos) |
| CoW migrations on production | **Not applied** (preflight `cowMigrationApplied: false`) |
| Assessment versioning on production | **Absent** (correct; skip `120000`) |
| Ten fictional cases intact | Preflight count **10**; statuses match expected portfolio |
| Existing approvals intact | 7 decisions + 4 handoffs in verified logical export |
| Peak-load wording in customer fields | None detected |
| Phase 2A/2B code + SQL on branch | Present in **working tree**; migrations / CoW modules largely **untracked** — must be committed before deploy |

### Production backup inventory (outside Git)

| File | Role |
|------|------|
| `schema.sql` | Schema dump (portable, no table GRANTs) |
| `schema-with-acl.sql` | Schema dump **with** GRANTs |
| `data.sql` | Data dump |
| `roles.sql` | Roles (`pg_dumpall --roles-only --no-role-passwords`) |
| `policies.sql` | Extracted `CREATE POLICY` lines |
| `MANIFEST.json` | Checksums + content checks (`passed: true`) |
| `logical-service-role/` | Prior verified HTTPS service_role JSON export |

**Residual risk:** a full isolated restore drill has **not** been performed. Recovery procedure exists on paper; restore confidence is incomplete.

### Production preflight snapshot (read-only, 2026-11-22)

Artifact: `docs/lifecycle-phase1-nov2026/phase3b-production-preflight-latest.json`

- `support_cases` count: **10**
- CoW columns/tables/RPC: **absent** (expected pre-migrate)
- Templates: Orchid `awaiting_decision`; Meridian `investigation_continues`; Vertex `escalated`; plus seven other `[DEMO]` customers unchanged

### Static checks (this package)

| Check | Result |
|-------|--------|
| Vitest | **304 passed**, 10 skipped (66 files) |
| `tsc --noEmit` | **Pass** |
| `next build` | **Pass** (Next.js 16.3.4) |
| ESLint | 2 warnings + 1 error in `scripts/register-server-only.cjs` (test helper `require`); app paths clean enough for release — fix optional before merge |

---

## 2. Migration SQL review (do not apply yet)

### Execution order (approved set only)

1. `supabase/migrations/20261122130000_demo_workspaces_copy_on_write.sql`
2. `supabase/migrations/20261122140000_demo_downstream_records.sql`
3. `supabase/production/phase3b-service-role-grants-minimal.sql`

**Exclude:** `20261122120000_assessment_versions_and_multi_decisions.sql` (not required; not verified for this cut).

### Staging parity

Staging (`mmebhgkpylaxqvtjrvyt`) successfully ran the **same** `130000` + `140000` migration files from this repo, then a **broader** staging grants script (`supabase/staging/phase3a-service-role-grants.sql`) because a greenfield project hit RLS/privilege gaps.

Production must **not** reuse the broad staging grants file. Use only `phase3b-service-role-grants-minimal.sql` (new CoW objects + purge execute + re-affirm `persist_decision_outcome`).

### `130000` — demo workspaces / CoW

| Topic | Assessment |
|-------|------------|
| Dependencies | Additive on Phase 7 schema; **does not** require `120000` |
| New objects | `demo_workspaces`; columns on `support_cases`, `human_decisions`, `engineering_handoffs`; `purge_expired_demo_workspaces`; replaces `persist_decision_outcome` |
| Existing data | Backfills `is_simulated = false`; nullable CoW columns leave templates unchanged |
| Constraints | Unique fork `(demo_workspace_id, cloned_from_case_id)`; expiry `CHECK (expires_at > created_at)`; FKs cascade workspace → forks |
| RLS | Deny-all on `demo_workspaces`; service_role bypasses RLS (app pattern) |
| Error handling | `persist_decision_outcome` raises `CASE_NOT_AWAITING_DECISION` when status race loses |
| Rollback | Manual (documented in SQL comments). Prefer app kill-switch first. Dropping columns while forks exist is risky |

### `140000` — downstream records

| Topic | Assessment |
|-------|------------|
| Dependencies | **Requires** `130000` (`demo_workspaces` FK) |
| Constraints | Unique `(demo_workspace_id, case_id, destination)`; destination `jira`/`rootly`; reference length 1–80 |
| Cascade | Workspace or case delete removes rows |
| RLS | Deny-all on `demo_downstream_records` |
| Rollback | `DROP TABLE demo_downstream_records` (visitor data only) |

### Minimal grants (production)

Safe scope:

- `GRANT` CRUD on `demo_workspaces` / `demo_downstream_records` to `service_role`
- `REVOKE` from `PUBLIC` / `anon` / `authenticated` on those tables
- `GRANT EXECUTE` on `purge_expired_demo_workspaces(timestamptz)`
- Re-affirm `persist_decision_outcome` execute for `service_role`

Does **not** enable RLS on legacy tables or grant execute on all public functions.

### Compatibility verdict

Migrations are **additive** and compatible with the ten existing fictional templates and seven organisational decisions. Unique indexes do not conflict with template rows (`demo_workspace_id IS NULL`). No automatic transaction wraps multi-file SQL Editor runs — apply in order and stop on first error.

---

## 3. Production environment (config readiness)

### Code guarantees (already implemented)

| Requirement | Implementation |
|-------------|----------------|
| 48-hour workspace expiry | `DEMO_WORKSPACE_TTL_MS = 48 * 60 * 60 * 1000` |
| Cookie name | `eee_demo_workspace` |
| Cookie flags | `httpOnly: true`, `sameSite: 'lax'`, `secure: true` when `NODE_ENV=production` |
| Signing secret | `DEMO_WORKSPACE_SECRET` required in non-dev/non-test |
| Server-only Supabase | `SUPABASE_SERVICE_ROLE_KEY` not `NEXT_PUBLIC_*` |

### Local workstation vs hosted production

| Item | Local `.env.local` | Hosted production (Vercel/host) |
|------|-------------------|--------------------------------|
| `SUPABASE_URL` → `zfpakilfxnwhlcfjgemw` | Present | **Confirm on host** |
| `SUPABASE_SERVICE_ROLE_KEY` | Present | **Confirm on host** |
| `CASE_REPOSITORY=supabase` | Present | **Confirm on host** |
| `DEMO_WORKSPACE_SECRET` | **Missing** | **Must set before interactive CoW** |
| Purge schedule | N/A | **Not configured yet** |
| `OPENAI_API_KEY` / model | As needed for analyze | Confirm if live analyze required |

Do not print secret values. Generate `DEMO_WORKSPACE_SECRET` as a long random string in the host secret store only.

### Still missing before cutover

1. Commit (or otherwise ship) the Phase 2A/2B working-tree changes onto the release branch / PR.
2. Set hosted `DEMO_WORKSPACE_SECRET`.
3. Confirm hosted Supabase URL/key/`CASE_REPOSITORY` match production.
4. Enable hourly or daily purge (Supabase `pg_cron` or platform cron calling `purge_expired_demo_workspaces(now())`).
5. Optional but recommended: isolated restore drill into a throwaway project.

---

## 4. Deployment runbook (ordered)

Execute only after explicit Phase 3C approval.

### 1. Production preflight

```bash
node scripts/production-preflight.mjs
```

Expect: ref `zfpakilfxnwhlcfjgemw`, 10 demos, `cowMigrationApplied: false`.  
Confirm backup folder + `MANIFEST.json` still pass checksums.

### 2. Migration application

In Supabase SQL Editor on **production only**, in order:

1. Paste/run `20261122130000_demo_workspaces_copy_on_write.sql` — stop on error  
2. Paste/run `20261122140000_demo_downstream_records.sql` — stop on error  

Do **not** run `120000`. Do **not** run staging grants.

### 3. Minimal grants

Run `supabase/production/phase3b-service-role-grants-minimal.sql`.

### 4. Schema and data verification

```bash
node scripts/production-preflight.mjs
```

Expect: CoW objects **present**; assessment versioning still **absent**; still **10** `[DEMO]` templates with unchanged statuses (Orchid awaiting; Meridian investigation; Vertex escalated).

Optional SQL spot-checks:

```sql
SELECT count(*) FROM support_cases WHERE customer ILIKE '%[DEMO]%';
SELECT count(*) FROM demo_workspaces; -- expect 0 before smoke tests
SELECT purge_expired_demo_workspaces('1970-01-01'::timestamptz); -- expect 0
```

### 5. Production environment configuration

On the **host** (not in git):

1. Set `DEMO_WORKSPACE_SECRET` (long random)  
2. Confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CASE_REPOSITORY=supabase`  
3. Confirm no service role in `NEXT_PUBLIC_*`

### 6. Application deployment

1. Ensure release commit contains Phase 2A/2B app + SQL artifacts  
2. Merge/deploy the approved commit to production host  
3. Confirm `NODE_ENV=production` so cookies are `Secure`

### 7. Orchid / Meridian / Vertex smoke tests

Limit writes to **new anonymous workspaces**. Do not mutate templates.

- **Orchid:** Approve → private fork; template stays `awaiting_decision`; Jira then Rootly (preview → confirm); refresh persists  
- **Meridian:** Investigation Continues; no Approve; no Jira/Rootly  
- **Vertex:** Corrected organisational rationale visible; Create escalation via CoW without second approval; template `is_simulated` remains false  

### 8. Cross-session isolation

- Second browser/profile cannot open first visitor’s fork URL (404 / not available)  
- Queue still shows shared templates, not another visitor’s forks  

### 9. Purge scheduling and verification

```sql
SELECT purge_expired_demo_workspaces(now());
```

- Schedule hourly (preferred) or daily via `pg_cron` / platform cron  
- Never call purge from anonymous visitor requests  
- Verify: expired test workspace removed; templates retained  

### 10. Monitoring and recovery

**Monitor (24–48h):**

- App errors around cookie signing / unique-constraint races  
- Purge job return counts  
- Template count remains 10  

**Kill-switch (disable new interactive demo writes):**

Preferred (minimal, explicit):

1. Set `DEMO_INTERACTIVE_WRITES=0` (or `false` / `off` / `disabled`) on the host  
2. Restart/redeploy so the env is picked up  
3. Effect: Server Actions refuse new workspace creates, CoW clones, simulated approvals, and simulated Jira/Rootly writes. Case Queue + shared templates remain readable. Existing cookies/forks are left in place (not wiped).

Avoid as first response:

- `CASE_REPOSITORY=memory` — hides Supabase-backed visitor forks and can look like data loss to in-flight sessions  
- Removing `DEMO_WORKSPACE_SECRET` — breaks cookie verify mid-session and does not cleanly signal “read-only”

Optional cleanup after freeze: `DELETE FROM demo_workspaces;` (cascades visitor forks + downstream only; templates remain)

**Rollback matrix**

| Layer | Can roll back? | Notes |
|-------|----------------|-------|
| App deploy | **Yes** | Redeploy previous build; templates unchanged |
| Kill-switch env | **Yes** | Stops new CoW writes immediately after restart |
| Visitor forks / downstream | **Yes** | Delete workspaces or wait for purge |
| `130000`/`140000` columns/tables | **Manual / hard** | Prefer leave schema; avoid dropping while live |
| `persist_decision_outcome` replace | **Manual** | Restore prior function definition only if required |
| Data loss of templates | **Backup restore** | Use off-site dump; restore drill **not** yet proven |
| Accidental broad grants / RLS on core tables | **Avoid** | Do not run staging grants file |

---

## 5. Release-readiness summary

### Ready

- Verified official PostgreSQL backup + logical export (checksums pass)  
- Production still pre-CoW; ten demos + approvals intact  
- Staging verified CoW/downstream behaviour on `mmebhgkpylaxqvtjrvyt`  
- Migration SQL + minimal grants reviewed; additive and staging-matched for `130000`/`140000`  
- Cookie/TTL/RLS/deny-all design reviewed  
- Vitest / `tsc` / production `next build` pass  

### Still missing (approval blockers)

1. **Git commit / PR** of Phase 2A/2B working-tree changes (migrations currently untracked)  
2. Hosted **`DEMO_WORKSPACE_SECRET`**  
3. Hosted env confirmation (URL / service role / `CASE_REPOSITORY`)  
4. **Purge cron** ownership and enablement plan  
5. Explicit approval to apply SQL + deploy  

### Residual risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| No restore drill | Medium | Keep dump off-site; optional throwaway restore before/after migrate |
| Free-plan (no PITR) | Medium | Manual dump only; re-dump after successful migrate |
| Uncommitted release tree | High until committed | Commit/review before production deploy |
| SQL Editor non-transactional multi-file apply | Medium | Apply in order; stop on first error; preflight after each major step |
| Using staging grants on prod | High if mistaken | Use **minimal** grants only |
| Visitor data accumulates without purge | Low–medium | Enable cron at cutover |

### Exact steps requiring approval

1. Commit Phase 2A/2B release artifacts on `feature/assessment-redesign` (and open/merge PR if that is the process)  
2. Apply `130000` → `140000` → minimal grants on production `zfpakilfxnwhlcfjgemw`  
3. Set production host `DEMO_WORKSPACE_SECRET` (+ confirm other env)  
4. Deploy the application build  
5. Enable purge schedule  
6. Run production smoke + isolation checklist  

---

## Stop

**No production Supabase modifications, migrations, merges, or deploys have been performed for Phase 3C.**  

Await explicit approval before executing the runbook above.
