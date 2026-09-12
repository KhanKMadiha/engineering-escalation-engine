# Database setup (Phase 7)

Persistent storage uses **Supabase Postgres**. Domain logic does not talk to Supabase directly — only `SupabaseCaseRepository` does.

## Schema overview

| Table | Purpose | Cardinality |
|-------|---------|-------------|
| `support_cases` | Support case records (incl. optional `steps_to_reproduce`, nullable expected/actual behaviour) | 1 per case |
| `case_analyses` | Validated AI analysis | **1** current analysis per case (`UNIQUE case_id`) |
| `escalation_results` | Deterministic engine output | **1** current result per case |
| `human_decisions` | Authoritative human decision | **1** per case (`UNIQUE case_id`) |
| `engineering_handoffs` | Engineering handoff (approve only; includes reproduction fields) | **0..1** per case |
| `case_events` | Audit trail | many per case |

Apply `20260907090000_reproduction_fields.sql` after the Phase 7 migration for reproduction columns.

### JSONB fields (document-like nested data)

Normalized relational columns hold IDs, statuses, scores, and decision metadata.
JSONB is used where the domain already treats data as structured documents:

- `case_analyses.ai_result`, evidence arrays, provenance, warnings
- `escalation_results.contributing_factors`, `recommendation_reasons`
- `engineering_handoffs.evidence`, `missing_evidence`
- `case_events.metadata` (safe audit metadata only)

### Constraints / indexes

- Foreign keys from all child tables → `support_cases(id)`
- Unique `case_id` on analyses, escalation results, decisions, handoffs
- Indexes on case status, case timestamps, and `case_events(case_id, created_at)`

### Atomic decision RPC

`persist_decision_outcome(...)` writes decision + optional handoff + status + events in one transaction. Business rules remain in `DecisionService`.

## Initialise a project

1. Create a Supabase project (or local Supabase stack).
2. In the SQL Editor (or `psql`), run:

   `supabase/migrations/20260907000000_phase7_persistence.sql`

3. Copy `.env.example` → `.env.local` and set:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CASE_REPOSITORY=supabase
OPENAI_API_KEY=...
```

**Never** put the service-role key in `NEXT_PUBLIC_*` variables or client components.

4. Start the app: `npm run dev`

5. To force in-memory (no database): `CASE_REPOSITORY=memory` (or omit Supabase env vars).

## Integration tests

Live Supabase integration tests are **opt-in**. They require:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RUN_SUPABASE_INTEGRATION=1
```

Without those variables, integration tests are skipped. Unit/mapping/contract tests always run against pure mappers and the in-memory repository.
