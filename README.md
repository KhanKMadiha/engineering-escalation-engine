# Engineering Escalation Engine

AI-assisted support operations platform for investigating customer issues, deciding whether engineering escalation is warranted, generating structured handoffs, and capturing human decisions.

## Architecture

```
                    ┌── Web UI
                    │
                    ↓
             Application Services
               ↑           ↑
               │           │
        Server Actions   REST API (/api/v1)
               │           │
               └─────┬─────┘
                     ↓
               Domain Logic
                     ↓
               Repository
                     ↓
              Supabase/Postgres (or in-memory)
```

Decision authority (unchanged):

```
AI Analysis
    ↓
Evidence Validation
    ↓
Deterministic Escalation Engine   ← recommends only
    ↓
Human Decision                    ← sole authority for escalated
    ↓
Engineering Handoff
    ↓
Integrations execute              ← after approval only
```

AI analyses. Rules recommend. Humans decide. Integrations execute.

AI does not decide. The engine does not authorize. Only a human decision authorizes escalation. Downstream actions run only after approval.

| Layer | Owns |
|-------|------|
| AI analysis | Structured case analysis + evidence candidates |
| Evidence validation | Trusted `extracted_evidence` only |
| Escalation Engine | Deterministic score + recommendation (no DB, no OpenAI) |
| Human decision | Sole authority for `escalated` status |
| Repository | Persistence only |
| REST API | Validation + HTTP mapping — **no business logic** |

## Getting started

```bash
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY (and optionally Supabase vars — see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Persistence (Phase 7)

By default the app uses the **in-memory** repository (data lost on restart).

To use **Supabase/Postgres**:

1. Create a Supabase project.
2. Apply `supabase/migrations/20260907000000_phase7_persistence.sql` (see `supabase/README.md`).
3. Set in `.env.local`:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CASE_REPOSITORY=supabase
```

Service-role credentials are **server-only**. Never use `NEXT_PUBLIC_` for secrets.

### REST API (Phase 8)

Versioned under `/api/v1`. OpenAPI: [GET /api/docs](http://localhost:3000/api/docs) or `docs/api.md`.

| Method | Path |
|--------|------|
| GET | `/api/v1/health` |
| GET | `/api/v1/health/ready` |
| POST / GET | `/api/v1/cases` |
| GET | `/api/v1/cases/:id` |
| POST | `/api/v1/cases/:id/analyze` |
| POST | `/api/v1/cases/:id/decision` |
| GET | `/api/v1/cases/:id/events` |
| GET | `/api/v1/cases/:id/handoff` |

- **Auth:** not implemented — controlled/demo use only; production needs auth + RBAC.
- **Errors:** `{ "error": { "code", "message", "requestId" } }`
- **Request ID:** `x-request-id` (operational correlation; not case evidence)
- **Pagination:** `?page=1&pageSize=25` (max 100); filters `status`, `severity`
- **Case fields:** optional `stepsToReproduce`, `expectedBehaviour`, `actualBehaviour` (customer/support-provided; steps alone ≠ confirmed reproducibility)
- **Concurrency:** analysis locks + unique human decisions preserved through the API
- **CORS:** no broad permissive CORS; intended for same-origin / internal clients
- **Integrations:** REST API does not create Jira/Rootly work items

### Demo downstream actions (simulated Jira / Rootly)

After human approval, the Handoff tab offers **demo-only** Jira and Rootly actions so the full support-to-engineering workflow can be shown in portfolio walkthroughs.

| | |
|--|--|
| What they do | Build deterministic local previews from the **approved handoff** |
| What they do **not** do | Call Jira/Rootly, use tokens/OAuth/SDKs, or make network requests |
| When available | Only after human approval + generated handoff |
| State | UI/session memory only — resets on refresh; not persisted |
| IDs | Deterministic (`ENG-DEMO-####`, `INC-DEMO-###`) from case + handoff IDs |

Real integration adapters could replace these demo adapters later without changing the AI → rules → human decision workflow.

### Demo cases (fictional)

Three labelled `[DEMO]` support cases for walkthroughs. They are **not** real incidents. Seeded through `CaseService` + `CaseOrchestrator` (validation + provenance preserved). Analysis uses fixed demo payloads (no OpenAI). **Human decision is never auto-applied** — Case 1 stays `awaiting_decision` even when the engine recommends escalate.

| Key | Customer (fictional) | Intent | Reported | Status after seed | Expected recommendation |
|-----|----------------------|--------|----------|--------------------|-------------------------|
| `clear_escalation` | Northstar Financial | API v3 strong evidence → human approve | 8 Sep 2026 | `escalated` | `escalate` |
| `insufficient_evidence` | Meridian Systems | SSO after IdP cert rotation | 11 Sep 2026 | `awaiting_decision` | `insufficient_evidence` |
| `continue_investigation` | Apex Digital | MS Teams Auto-Answer → human continues investigation | 12 Sep 2026 | `investigation_continues` | `continue_investigation` |

There is no `investigating` workflow status. Case C uses `investigation_continues` after a real DecisionService reject (closest valid “active investigation” state).

Reported dates are fixed deterministic seed timestamps (not “today”). **Clear existing `[DEMO]` rows before reseeding** — seed skips matching titles and will otherwise leave old cases alongside new titles.

**Requires explicit action** — never auto-runs in production:

```bash
# Persist to the configured repository (Supabase if CASE_REPOSITORY=supabase)
ALLOW_DEMO_SEED=1 npm run seed:demo

# For in-memory UI during `npm run dev` (same Node process as the app):
ALLOW_DEMO_SEED=1 npm run dev
# then:
curl -X POST http://localhost:3000/api/demo/seed
```

CLI in-memory seed only lives in that process; use `POST /api/demo/seed` so the Next.js app’s memory store is populated.

**Updating demo data:** seed skips cases whose `issueTitle` already exists. If you still see an old product such as `Content API v3`, or an old placeholder customer such as `Example Enterprise A`, clear the stale demo rows and reseed (see below). A seed response may include `staleSkipped` when a stored product or customer no longer matches the canonical definition.

```bash
# In-memory (default CASE_REPOSITORY=memory): restart the Next.js process, then
ALLOW_DEMO_SEED=1 npm run dev
curl -X POST http://localhost:3000/api/demo/seed

# Supabase: delete fictional demo rows, then reseed
# DELETE FROM support_cases WHERE customer LIKE '%[DEMO]%' OR issue_title LIKE '%[DEMO]%';
ALLOW_DEMO_SEED=1 CASE_REPOSITORY=supabase npm run seed:demo
```

### Scripts

```bash
npm test          # unit + API + contract tests (no live Supabase required)
npm run lint
npm run build
ALLOW_DEMO_SEED=1 npm run seed:demo   # fictional demo cases (explicit only)
```

Support cases capture structured reproduction information when available:

- Steps to Reproduce
- Expected Behaviour
- Actual Behaviour
- Reproducibility (AI assessment — advisory; confirmed reproduction is a separate Escalation Engine signal)

Documented steps do **not** automatically establish that an issue is reproducible.

## Security

See [SECURITY.md](./SECURITY.md). Authentication / RBAC are **not** implemented yet; `decidedBy` remains a placeholder (`support_engineer`).

## Stack

- Next.js (App Router) + TypeScript + React
- Zod validation
- OpenAI structured outputs (server-side)
- Supabase JS client (server-side persistence)
- Vitest
