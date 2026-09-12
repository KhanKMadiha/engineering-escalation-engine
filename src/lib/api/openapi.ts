const errorContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ApiError" },
  },
};

const caseIdParam = {
  name: "id",
  in: "path" as const,
  required: true,
  schema: { type: "string", format: "uuid" },
};

/**
 * OpenAPI 3.1 specification for Engineering Escalation Engine REST API v1.
 * Served at GET /api/docs — keep in sync with implemented routes only.
 */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Engineering Escalation Engine API",
    version: "1.0.0",
    description: [
      "Internal support-operations REST API (Phase 8).",
      "",
      "**Authentication:** not implemented. Suitable for controlled/demo use only.",
      "Production exposure requires authentication and RBAC before multi-user deployment.",
      "",
      "**Architecture:** routes validate input and call application services.",
      "They do not access Supabase directly, calculate escalation scores,",
      "authorize escalation, or generate handoffs independently.",
      "",
      "**Request IDs:** send `x-request-id` (UUID) for correlation, or one is generated.",
      "Operational only — not customer evidence / support-case request IDs.",
      "",
      "**Concurrency:** analysis uses process-local locks; human decisions are uniquely constrained in persistence.",
      "No distributed API rate limiter or create-idempotency store in Phase 8.",
    ].join("\n"),
  },
  servers: [{ url: "/", description: "Application origin" }],
  tags: [{ name: "Cases" }, { name: "Health" }],
  paths: {
    "/api/v1/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness",
        operationId: "getHealth",
        responses: {
          "200": { description: "Process is responding" },
        },
      },
    },
    "/api/v1/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness",
        operationId: "getReadiness",
        responses: {
          "200": { description: "Persistence backend is configured" },
          "503": { description: "Persistence not ready" },
        },
      },
    },
    "/api/v1/cases": {
      get: {
        tags: ["Cases"],
        summary: "List cases",
        operationId: "listCases",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "severity",
            in: "query",
            schema: {
              type: "string",
              enum: ["critical", "high", "medium", "low"],
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25,
            },
          },
        ],
        responses: {
          "200": { description: "Paginated case summaries" },
          "422": { description: "Invalid query", content: errorContent },
        },
      },
      post: {
        tags: ["Cases"],
        summary: "Create case",
        operationId: "createCase",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCaseRequest" },
              example: {
                customer: "Acme Corp",
                product: "Payments API",
                severity: "high",
                issueTitle: "Checkout timeouts",
                issueDescription: "Customers report 504s during checkout.",
                environment: "production",
                stepsToReproduce:
                  "1. Navigate to checkout\n2. Submit payment\n3. Observe timeout",
                expectedBehaviour: "Checkout completes within 2 seconds.",
                actualBehaviour: "Requests time out after 30 seconds.",
                troubleshootingPerformed: "Checked gateway status page.",
                logsErrors: "ERROR gateway timeout upstream",
                requestIds: "req_abc123",
                incidentTimestamp: "2026-09-05T10:00:00.000Z",
                issueFirstObserved: "This morning",
                affectedCustomerCount: 3,
              },
            },
          },
        },
        responses: {
          "201": { description: "Case created" },
          "415": {
            description: "Unsupported media type",
            content: errorContent,
          },
          "422": { description: "Validation failed", content: errorContent },
        },
      },
    },
    "/api/v1/cases/{id}": {
      get: {
        tags: ["Cases"],
        summary: "Get case detail",
        operationId: "getCase",
        parameters: [caseIdParam],
        responses: {
          "200": { description: "Case with workflow state" },
          "404": { description: "Not found", content: errorContent },
        },
      },
    },
    "/api/v1/cases/{id}/analyze": {
      post: {
        tags: ["Cases"],
        summary: "Run analysis + escalation pipeline",
        description:
          "Calls CaseOrchestrator. Does not call OpenAI from the route. Conflicts if analysis is in progress or already completed.",
        operationId: "analyzeCase",
        parameters: [caseIdParam],
        responses: {
          "200": { description: "Analysis completed" },
          "404": { description: "Not found", content: errorContent },
          "409": { description: "Conflict", content: errorContent },
          "502": {
            description: "Analysis provider/schema failure",
            content: errorContent,
          },
        },
      },
    },
    "/api/v1/cases/{id}/decision": {
      post: {
        tags: ["Cases"],
        summary: "Record human decision",
        description:
          "Calls DecisionService only. Approve → escalated + handoff. Reject → investigation_continues.",
        operationId: "recordDecision",
        parameters: [caseIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DecisionRequest" },
              example: {
                decision: "approved",
                rationale: "Reproducible in production with validated logs.",
              },
            },
          },
        },
        responses: {
          "200": { description: "Decision recorded" },
          "404": { description: "Not found", content: errorContent },
          "409": {
            description: "Conflict / invalid state",
            content: errorContent,
          },
          "422": { description: "Validation failed", content: errorContent },
        },
      },
    },
    "/api/v1/cases/{id}/events": {
      get: {
        tags: ["Cases"],
        summary: "List audit events",
        description: "Chronological order.",
        operationId: "listCaseEvents",
        parameters: [caseIdParam],
        responses: {
          "200": { description: "Events" },
          "404": { description: "Not found", content: errorContent },
        },
      },
    },
    "/api/v1/cases/{id}/handoff": {
      get: {
        tags: ["Cases"],
        summary: "Get engineering handoff",
        description:
          "Returns the persisted handoff only; does not generate one.",
        operationId: "getCaseHandoff",
        parameters: [caseIdParam],
        responses: {
          "200": { description: "Handoff" },
          "404": {
            description: "Case or handoff not found",
            content: errorContent,
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string", format: "uuid" },
              details: { type: "object", additionalProperties: true },
            },
          },
        },
      },
      CreateCaseRequest: {
        type: "object",
        required: [
          "customer",
          "product",
          "severity",
          "issueTitle",
          "issueDescription",
          "environment",
          "troubleshootingPerformed",
          "logsErrors",
          "requestIds",
        ],
        properties: {
          customer: { type: "string" },
          product: { type: "string" },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          issueTitle: { type: "string" },
          issueDescription: { type: "string" },
          environment: {
            type: "string",
            enum: ["production", "staging", "development", "unknown"],
          },
          stepsToReproduce: {
            type: "string",
            description:
              "Optional customer/support-provided reproduction steps. Presence alone does not mean confirmed reproducibility.",
          },
          expectedBehaviour: {
            type: "string",
            description: "Optional. What should have happened.",
          },
          actualBehaviour: {
            type: "string",
            description: "Optional. What actually happened.",
          },
          troubleshootingPerformed: { type: "string" },
          logsErrors: { type: "string" },
          requestIds: { type: "string" },
          incidentTimestamp: {
            type: ["string", "null"],
            description:
              "Optional precise ISO datetime. Do not send approximate free text here.",
            format: "date-time",
          },
          issueFirstObserved: {
            type: ["string", "null"],
            description:
              "Optional approximate timeframe when the issue was first observed (e.g. \"This morning\"). Not parsed into a timestamp.",
            maxLength: 500,
          },
          affectedCustomerCount: { type: ["integer", "null"] },
        },
      },
      DecisionRequest: {
        type: "object",
        required: ["decision", "rationale"],
        properties: {
          decision: { type: "string", enum: ["approved", "rejected"] },
          rationale: { type: "string", minLength: 10, maxLength: 4000 },
        },
      },
    },
  },
};
