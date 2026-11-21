# Outstanding: Supabase migration-history reconciliation

**Status:** Open (post-deploy follow-up)  
**Project ref:** `zfpakilfxnwhlcfjgemw`  
**Date noted:** 2026-11-21

## What happened

The following migrations were applied manually via the Supabase SQL Editor (not `supabase db push`):

1. `20261120120000_ticket_import_fields`
2. `20261121160000_technical_evidence`
3. Least-privilege grants for technical evidence (`20261121170000_technical_evidence_grants` in repo; applied as a standalone GRANT script in production)

## Risk if unrepaired

A future `supabase db push` / migrate against this project may attempt to re-run those versions. The SQL is largely idempotent (`IF NOT EXISTS` / create-if-missing), but history should still be reconciled.

## Recommended fix (when CLI auth / DB password is available)

```bash
npx supabase link --project-ref zfpakilfxnwhlcfjgemw
npx supabase migration repair --status applied \
  20261120120000 \
  20261121160000 \
  20261121170000 \
  --remote
```

Do **not** recreate `supabase_migrations.schema_migrations` manually in the SQL Editor.
