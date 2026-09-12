# Security

Security and trust-boundary notes for the Engineering Escalation Engine.

## 1. Trust boundaries

| Boundary | Rule |
|----------|------|
| Customer case content | Untrusted **data**, never application instructions |
| AI model output | Untrusted until Zod schema validation **and** evidence validation succeed |
| Escalation score / recommendation | Owned only by the deterministic Escalation Engine |
| Case status `escalated` | Owned only by human decision (`DecisionService`) |
| Secrets (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) | Server-only; never exposed via `NEXT_PUBLIC_*` or client bundles |
| Database access | Server-side only via `SupabaseCaseRepository` |
| REST API | Thin HTTP boundary; no direct DB access; no escalation authority |

## 2. AI input handling

- Case fields are wrapped as payload data in the analysis prompt.
- System instructions state that payload text must not be treated as commands.
- Prompt injection text inside customer fields must not change deterministic application behaviour (scoring, status transitions, handoff generation).
- The application does **not** execute model-suggested status changes.

## 3. Evidence validation

- AI-quoted excerpts must appear in the referenced customer field (normalized whitespace).
- Invalid excerpts are rejected and never become `extracted_evidence`.
- AI inference remains labelled `ai_inference` and is never presented as customer-provided fact.

## 4. Human approval boundary

- Score ≥ 70 does **not** escalate a case.
- The Escalation Engine cannot transition status to `escalated`.
- Only an explicit human approve action records a decision and may move the case to `escalated`.
- REST `POST /api/v1/cases/:id/decision` must call `DecisionService` — routes must never set `status = escalated` themselves.

## 5. Secret handling

- `OPENAI_API_KEY` is read only in `src/lib/openai/client.ts` (guarded by `server-only`).
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read only in `src/lib/supabase/` (client guarded by `server-only`).
- Service-role credentials must **never** use `NEXT_PUBLIC_*` and must **never** be returned by API responses.
- `.env.example` contains placeholders only.
- Server Actions and REST handlers must not return secrets or stack traces.

## 6. Sensitive logging

Operational logs may include:

- request ID (API)
- route / method / status / duration
- case ID
- event / failure category
- safe error name / redacted message

Operational logs must **not** include:

- API keys, service-role keys, or bearer tokens
- full case bodies
- full model prompts
- authorization headers
- unnecessary raw model responses

## 7. Persistence (Phase 7)

- Operational records persist in Supabase/Postgres when configured.
- Domain logic does **not** import Supabase.
- One authoritative human decision per case (`UNIQUE`).
- Approve path uses `persist_decision_outcome` for atomic consistency.

## 8. REST API exposure (Phase 8)

- Versioned under `/api/v1`; OpenAPI at `/api/docs`.
- Inputs validated server-side (Zod + existing schemas).
- JSON content-type enforced for write bodies; body size capped (~512KB).
- Stable error shape with machine-readable `code` + `requestId`.
- `x-request-id` is an **operational correlation ID**, not customer evidence.
- No broad permissive CORS (same-origin / controlled internal clients).
- Pagination max page size enforced (100).

### Authentication status

**Authentication and RBAC are not implemented.**

The API is suitable for controlled/demo use only. Public or multi-user production exposure requires:

- authenticated identity for callers
- authorization so only permitted support personnel can record decisions
- least-privilege database credentials (service role must never reach API clients)

Do not treat the presence of a REST API as production-ready external exposure.

### Idempotency / rate limiting

- Human decisions: uniqueness + process-local decision locks preserved.
- Analysis: process-local analysis locks preserved; already-completed analysis still rejected.
- Case create: no distributed idempotency key store in Phase 8 (document limitation).
- No Redis / distributed API rate limiter in Phase 8.

## 9. Concurrency

**Process-local locks** prevent duplicate in-flight analysis/decision work within a single Node process.

**Database uniqueness** prevents two authoritative human decisions across instances.

### Known limitations

- Process-local analysis locks are **not** distributed.
- There is **no authentication** on Server Actions or REST.
- `decidedBy` remains a placeholder (`support_engineer`).
- Having a database and REST API does **not** make the app fully production-ready.

## 10. In-memory repository

`InMemoryCaseRepository` remains available for tests and local fallback (`CASE_REPOSITORY=memory`).

## 11. Future production considerations

- Authenticated identity for `decidedBy` and authorization/RBAC
- Supabase RLS or least-privilege DB roles
- Distributed locks / idempotency / API rate limiting
- Observability without logging sensitive payloads
- External engineering integrations (Jira/Slack/etc.) — **not implemented**
