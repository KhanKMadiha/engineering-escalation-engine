# Phase 3B — manual production backup (Free plan)

**Production ref:** `zfpakilfxnwhlcfjgemw`  
**Official method:** [`supabase db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)  
**Backup folder (outside git):** `~/Madiha/backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22/`

## Why this is required

Free plan projects have **no** automatic dashboard backups. A verified logical dump is a prerequisite before Phase 3C migrations.

## Current status

**Blocked on the production database password.**

Available locally:

- Supabase CLI (npm package `supabase` in `node_modules`, v3.2.0)
- Backup directory created outside the repository
- Dump script: `scripts/backup-production-db.mjs`

Not available:

- `SUPABASE_DB_PASSWORD` / production Postgres URI (service role JWT cannot replace this)

## Exact human step

1. Supabase Dashboard → production project `zfpakilfxnwhlcfjgemw`
2. **Project Settings → Database** → copy **Database password** (reset if needed)
3. Write it only to:  
   `~/Madiha/backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22/.env.backup`  
   as `SUPABASE_DB_PASSWORD=...`
4. Reply: **backup credentials ready**

Then run:

```bash
node scripts/backup-production-db.mjs
```

This produces `schema.sql`, `data.sql`, `roles.sql`, and `MANIFEST.json` with SHA-256 checksums and content checks for the ten fictional cases.

## Restore drill (after dump succeeds)

Use a **new empty** Supabase project — do **not** overwrite production or existing staging (`mmebhgkpylaxqvtjrvyt`).

1. Create project e.g. `eee-restore-verify-YYYYMMDD`
2. Load `schema.sql`, then `data.sql` (and `roles.sql` if needed)
3. Confirm ten `[DEMO]` cases + decisions/handoffs/analyses/events
4. Delete the restore project when done

## Phase 3C gate

Phase 3C is **not** ready until:

1. Dump files exist and `MANIFEST.json` reports `contentChecks.passed: true`
2. Recovery procedure is documented (this file + backup README)
3. Optional but preferred: restore drill on an isolated empty project succeeds
