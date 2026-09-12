# Engineering Escalation Engine — REST API (Phase 8)

OpenAPI document: [`src/lib/api/openapi.ts`](../src/lib/api/openapi.ts)  
Live: `GET /api/docs`

## Base path

All operational endpoints: `/api/v1/...`

## Authentication

**Not implemented.** Do not expose publicly without auth/RBAC.

## Endpoints

| Method | Path | Service |
|--------|------|---------|
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/health/ready` | Persistence readiness |
| POST | `/api/v1/cases` | `CaseService.createCase` |
| GET | `/api/v1/cases` | `CaseService.listCasesPage` |
| GET | `/api/v1/cases/:id` | `CaseService.getCaseById` |
| POST | `/api/v1/cases/:id/analyze` | `CaseOrchestrator.runAnalysisPipeline` |
| POST | `/api/v1/cases/:id/decision` | `DecisionService.recordDecision` |
| GET | `/api/v1/cases/:id/events` | Case audit events |
| GET | `/api/v1/cases/:id/handoff` | Persisted handoff only |

## Errors

```json
{
  "error": {
    "code": "CASE_NOT_FOUND",
    "message": "Case not found.",
    "requestId": "…"
  }
}
```

Header `x-request-id`: operational correlation ID (not case evidence).

## CORS

No permissive CORS. Intended for same-origin / controlled internal clients.
