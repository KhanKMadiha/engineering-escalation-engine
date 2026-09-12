import { beforeEach, describe, expect, it } from "vitest";
import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";
import {
  analyzeCaseHandler,
  createCaseHandler,
  getCaseHandler,
  getCaseHandoffHandler,
  listCaseEventsHandler,
  listCasesHandler,
  recordDecisionHandler,
} from "@/lib/api/handlers/cases";
import { healthHandler, readinessHandler } from "@/lib/api/handlers/health";
import { handleApiRequest } from "@/lib/api/http";
import { openApiDocument } from "@/lib/api/openapi";
import { REQUEST_ID_HEADER } from "@/lib/api/request-id";
import { createApiServices, type ApiServices } from "@/lib/api/services";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { resetRequestGuards } from "@/lib/security/request-guards";
import type { CreateCaseInput } from "@/types";

const sampleInput: CreateCaseInput = {
  customer: "Acme Corp",
  product: "Payments API",
  severity: "high",
  issueTitle: "Checkout timeouts",
  issueDescription: "Customers report 504s during checkout.",
  environment: "production",
  stepsToReproduce: "",
  expectedBehaviour: "Checkout completes within 2 seconds.",
  actualBehaviour: "Requests time out after 30 seconds.",
  troubleshootingPerformed: "Checked gateway status page.",
  logsErrors: "ERROR gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  affectedCustomerCount: 3,
};

function validAnalysisPayload() {
  return {
    assessedSeverity: "high" as const,
    issueCategory: "bug",
    reproducibility: "confirmed" as const,
    suspectedProductDefect: true,
    reasoning: "Logs show gateway timeouts.",
    evidenceIdentified: [
      {
        description: "Timeout log",
        sourceField: "logsErrors" as const,
        quotedExcerpt: "gateway timeout upstream",
      },
    ],
    missingEvidence: ["HAR"],
    recommendedNextSteps: ["Collect more logs"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_escalate" as const,
  };
}

function mockClient(
  impl: AnalysisModelClient["generateAnalysis"] = async () =>
    validAnalysisPayload(),
): AnalysisModelClient {
  return { model: "mock-model", generateAnalysis: impl };
}

function jsonRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  const init: RequestInit = {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

async function readJson(response: Response) {
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
    requestId: response.headers.get(REQUEST_ID_HEADER),
  };
}

describe("Phase 8 REST API", () => {
  let repo: InMemoryCaseRepository;
  let services: ApiServices;

  beforeEach(() => {
    resetRequestGuards();
    repo = new InMemoryCaseRepository();
    services = createApiServices({
      repository: repo,
      modelClient: mockClient(),
    });
  });

  describe("case creation", () => {
    it("1–4. valid POST creates case with stable schema", async () => {
      const response = await handleApiRequest(
        jsonRequest("POST", "http://localhost/api/v1/cases", sampleInput),
        "/api/v1/cases",
        (ctx) => createCaseHandler(ctx, services),
      );
      const { status, body, requestId } = await readJson(response);
      expect(status).toBe(201);
      expect(requestId).toBeTruthy();
      const data = body.data as Record<string, unknown>;
      expect(data.id).toMatch(
        /^[0-9a-f-]{36}$/i,
      );
      expect(data.customer).toBe("Acme Corp");
      expect(data.status).toBe("draft");
      expect(body).not.toHaveProperty("issue_title");
      expect(JSON.stringify(body)).not.toMatch(/supabase|service_role/i);
    });

    it("2. invalid body returns validation error", async () => {
      const response = await handleApiRequest(
        jsonRequest("POST", "http://localhost/api/v1/cases", {
          customer: "",
        }),
        "/api/v1/cases",
        (ctx) => createCaseHandler(ctx, services),
      );
      const { status, body } = await readJson(response);
      expect(status).toBe(422);
      expect((body.error as { code: string }).code).toBe("VALIDATION_ERROR");
      expect((body.error as { requestId: string }).requestId).toBeTruthy();
    });
  });

  describe("case list", () => {
    it("5–9. list, pagination, filters, max page size", async () => {
      for (let i = 0; i < 3; i += 1) {
        await services.caseService.createCase({
          ...sampleInput,
          issueTitle: `Issue ${i}`,
        });
      }

      const listed = await handleApiRequest(
        jsonRequest(
          "GET",
          "http://localhost/api/v1/cases?page=1&pageSize=2&severity=high",
        ),
        "/api/v1/cases",
        (ctx) => listCasesHandler(ctx, services),
      );
      const ok = await readJson(listed);
      expect(ok.status).toBe(200);
      expect((ok.body.data as unknown[]).length).toBe(2);
      expect(
        (ok.body.pagination as { pageSize: number; hasNextPage: boolean })
          .pageSize,
      ).toBe(2);
      expect(
        (ok.body.pagination as { hasNextPage: boolean }).hasNextPage,
      ).toBe(true);

      const badPage = await handleApiRequest(
        jsonRequest("GET", "http://localhost/api/v1/cases?pageSize=999"),
        "/api/v1/cases",
        (ctx) => listCasesHandler(ctx, services),
      );
      expect((await readJson(badPage)).status).toBe(422);

      const badFilter = await handleApiRequest(
        jsonRequest("GET", "http://localhost/api/v1/cases?severity=urgent"),
        "/api/v1/cases",
        (ctx) => listCasesHandler(ctx, services),
      );
      expect((await readJson(badFilter)).status).toBe(422);
    });
  });

  describe("case detail", () => {
    it("10–12. get existing / unknown / workflow fields", async () => {
      const created = await services.caseService.createCase(sampleInput);
      const ok = await handleApiRequest(
        jsonRequest("GET", `http://localhost/api/v1/cases/${created.id}`),
        "/api/v1/cases/:id",
        (ctx) => getCaseHandler(ctx, services),
        { id: created.id },
      );
      const payload = await readJson(ok);
      expect(payload.status).toBe(200);
      const data = payload.body.data as Record<string, unknown>;
      expect(data.status).toBe("draft");
      expect(data).toHaveProperty("analysis");
      expect(data).toHaveProperty("escalationResult");
      expect(data).toHaveProperty("decision");
      expect(data).toHaveProperty("handoff");

      const missing = await handleApiRequest(
        jsonRequest(
          "GET",
          "http://localhost/api/v1/cases/00000000-0000-4000-8000-000000000000",
        ),
        "/api/v1/cases/:id",
        (ctx) => getCaseHandler(ctx, services),
        { id: "00000000-0000-4000-8000-000000000000" },
      );
      const missingBody = await readJson(missing);
      expect(missingBody.status).toBe(404);
      expect((missingBody.body.error as { code: string }).code).toBe(
        "CASE_NOT_FOUND",
      );
    });
  });

  describe("analysis", () => {
    it("13–19. analyze via orchestrator with conflicts and safe failures", async () => {
      const created = await services.caseService.createCase(sampleInput);
      const first = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${created.id}/analyze`,
        ),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, services),
        { id: created.id },
      );
      const firstBody = await readJson(first);
      expect(firstBody.status).toBe(200);
      expect(
        (firstBody.body.data as { status: string }).status,
      ).toBe("awaiting_decision");

      const rerun = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${created.id}/analyze`,
        ),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, services),
        { id: created.id },
      );
      const rerunBody = await readJson(rerun);
      expect(rerunBody.status).toBe(409);
      expect((rerunBody.body.error as { code: string }).code).toBe(
        "ANALYSIS_ALREADY_COMPLETED",
      );

      const badId = await handleApiRequest(
        jsonRequest("POST", "http://localhost/api/v1/cases/not-a-uuid/analyze"),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, services),
        { id: "not-a-uuid" },
      );
      expect((await readJson(badId)).status).toBe(400);

      const unknown = await handleApiRequest(
        jsonRequest(
          "POST",
          "http://localhost/api/v1/cases/00000000-0000-4000-8000-000000000000/analyze",
        ),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, services),
        { id: "00000000-0000-4000-8000-000000000000" },
      );
      expect((await readJson(unknown)).status).toBe(404);

      const failingServices = createApiServices({
        repository: new InMemoryCaseRepository(),
        modelClient: mockClient(async () => {
          throw new Error("upstream boom");
        }),
      });
      const failCase = await failingServices.caseService.createCase(sampleInput);
      const failed = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${failCase.id}/analyze`,
        ),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, failingServices),
        { id: failCase.id },
      );
      const failedBody = await readJson(failed);
      expect(failedBody.status).toBe(502);
      expect(JSON.stringify(failedBody.body)).not.toMatch(/sk-|OPENAI_API_KEY/);
    });

    it("16. analysis in progress returns conflict", async () => {
      const created = await services.caseService.createCase(sampleInput);
      let release!: () => void;
      const gate = new Promise<ReturnType<typeof validAnalysisPayload>>(
        (resolve) => {
          release = () => resolve(validAnalysisPayload());
        },
      );
      const slow = createApiServices({
        repository: repo,
        modelClient: mockClient(async () => gate),
      });

      const pending = handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${created.id}/analyze`,
        ),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, slow),
        { id: created.id },
      );

      const conflict = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${created.id}/analyze`,
        ),
        "/api/v1/cases/:id/analyze",
        (ctx) => analyzeCaseHandler(ctx, slow),
        { id: created.id },
      );
      const conflictBody = await readJson(conflict);
      expect(conflictBody.status).toBe(409);
      expect((conflictBody.body.error as { code: string }).code).toBe(
        "ANALYSIS_IN_PROGRESS",
      );
      release();
      const pendingBody = await readJson(await pending);
      expect(pendingBody.status).toBe(200);
    });
  });

  describe("decision", () => {
    async function seedAwaiting() {
      const created = await services.caseService.createCase(sampleInput);
      const analyzed = await services.orchestrator.runAnalysisPipeline(
        created.id,
      );
      expect(analyzed.ok).toBe(true);
      return created.id;
    }

    it("20–29. approve/reject via DecisionService only", async () => {
      const approveId = await seedAwaiting();
      const approved = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${approveId}/decision`,
          {
            decision: "approved",
            rationale: "Reproducible in production with validated logs.",
          },
        ),
        "/api/v1/cases/:id/decision",
        (ctx) => recordDecisionHandler(ctx, services),
        { id: approveId },
      );
      const approvedBody = await readJson(approved);
      expect(approvedBody.status).toBe(200);
      const approvedData = approvedBody.body.data as {
        status: string;
        handoff: unknown;
        decision: { decidedBy: string; escalationScoreAtDecision: number };
      };
      expect(approvedData.status).toBe("escalated");
      expect(approvedData.handoff).toBeTruthy();
      expect(approvedData.decision.decidedBy).toBe("support_engineer");

      const duplicate = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${approveId}/decision`,
          {
            decision: "rejected",
            rationale: "Changed my mind after the fact.",
          },
        ),
        "/api/v1/cases/:id/decision",
        (ctx) => recordDecisionHandler(ctx, services),
        { id: approveId },
      );
      expect((await readJson(duplicate)).status).toBe(409);

      const rejectId = await seedAwaiting();
      const rejected = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${rejectId}/decision`,
          {
            decision: "rejected",
            rationale: "Need more request IDs before escalating.",
          },
        ),
        "/api/v1/cases/:id/decision",
        (ctx) => recordDecisionHandler(ctx, services),
        { id: rejectId },
      );
      const rejectedBody = await readJson(rejected);
      expect(rejectedBody.status).toBe(200);
      const rejectedData = rejectedBody.body.data as {
        status: string;
        handoff: unknown;
      };
      expect(rejectedData.status).toBe("investigation_continues");
      expect(rejectedData.handoff).toBeNull();

      const draft = await services.caseService.createCase({
        ...sampleInput,
        issueTitle: "Rationale check",
      });
      const shortRationale = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${draft.id}/decision`,
          { decision: "approved", rationale: "short" },
        ),
        "/api/v1/cases/:id/decision",
        (ctx) => recordDecisionHandler(ctx, services),
        { id: draft.id },
      );
      expect((await readJson(shortRationale)).status).toBe(422);

      const invalidDecision = await handleApiRequest(
        jsonRequest(
          "POST",
          `http://localhost/api/v1/cases/${draft.id}/decision`,
          { decision: "maybe", rationale: "xxxxxxxxxxxxxxxxxx" },
        ),
        "/api/v1/cases/:id/decision",
        (ctx) => recordDecisionHandler(ctx, services),
        { id: draft.id },
      );
      expect((await readJson(invalidDecision)).status).toBe(422);
    });
  });

  describe("events and handoff", () => {
    it("30–35. events chronological; handoff persisted only", async () => {
      const created = await services.caseService.createCase(sampleInput);
      await services.orchestrator.runAnalysisPipeline(created.id);
      await services.decisionService.recordDecision({
        caseId: created.id,
        decision: "approved",
        rationale: "Reproducible in production with validated logs.",
      });

      const events = await handleApiRequest(
        jsonRequest(
          "GET",
          `http://localhost/api/v1/cases/${created.id}/events`,
        ),
        "/api/v1/cases/:id/events",
        (ctx) => listCaseEventsHandler(ctx, services),
        { id: created.id },
      );
      const eventsBody = await readJson(events);
      expect(eventsBody.status).toBe(200);
      expect(eventsBody.body.order).toBe("chronological");
      const list = eventsBody.body.data as Array<{
        eventType: string;
        metadata: Record<string, unknown> | null;
      }>;
      expect(list.some((e) => e.eventType === "human_decision_recorded")).toBe(
        true,
      );
      expect(JSON.stringify(list)).not.toMatch(/apiKey|authorization|prompt/i);

      const handoff = await handleApiRequest(
        jsonRequest(
          "GET",
          `http://localhost/api/v1/cases/${created.id}/handoff`,
        ),
        "/api/v1/cases/:id/handoff",
        (ctx) => getCaseHandoffHandler(ctx, services),
        { id: created.id },
      );
      expect((await readJson(handoff)).status).toBe(200);

      const noHandoffCase = await services.caseService.createCase({
        ...sampleInput,
        issueTitle: "No handoff yet",
      });
      const missingHandoff = await handleApiRequest(
        jsonRequest(
          "GET",
          `http://localhost/api/v1/cases/${noHandoffCase.id}/handoff`,
        ),
        "/api/v1/cases/:id/handoff",
        (ctx) => getCaseHandoffHandler(ctx, services),
        { id: noHandoffCase.id },
      );
      const missingBody = await readJson(missingHandoff);
      expect(missingBody.status).toBe(404);
      expect((missingBody.body.error as { code: string }).code).toBe(
        "HANDOFF_NOT_FOUND",
      );
    });
  });

  describe("errors / health / security / docs", () => {
    it("36–42. error schema, request id, health, readiness", async () => {
      const reqId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      const response = await handleApiRequest(
        jsonRequest(
          "GET",
          "http://localhost/api/v1/cases/00000000-0000-4000-8000-000000000000",
          undefined,
          { [REQUEST_ID_HEADER]: reqId },
        ),
        "/api/v1/cases/:id",
        (ctx) => getCaseHandler(ctx, services),
        { id: "00000000-0000-4000-8000-000000000000" },
      );
      const body = await readJson(response);
      expect(body.requestId).toBe(reqId);
      expect(body.body.error).toMatchObject({
        code: "CASE_NOT_FOUND",
        requestId: reqId,
      });
      expect(JSON.stringify(body.body)).not.toMatch(/stack|at Object/);

      const health = await handleApiRequest(
        jsonRequest("GET", "http://localhost/api/v1/health"),
        "/api/v1/health",
        healthHandler,
      );
      expect((await readJson(health)).status).toBe(200);

      const ready = await handleApiRequest(
        jsonRequest("GET", "http://localhost/api/v1/health/ready"),
        "/api/v1/health/ready",
        readinessHandler,
      );
      const readyBody = await readJson(ready);
      expect(readyBody.status).toBe(200);
      expect((readyBody.body as { status: string }).status).toBe("ready");
    });

    it("43–45. openapi documents v1; routes stay service-backed", async () => {
      expect(openApiDocument.openapi).toBe("3.1.0");
      expect(openApiDocument.paths).toHaveProperty("/api/v1/cases");
      expect(openApiDocument.info.description).toMatch(/Authentication/i);

      const { readFile } = await import("node:fs/promises");
      const decisionRoute = await readFile(
        new URL(
          "../../src/app/api/v1/cases/[id]/decision/route.ts",
          import.meta.url,
        ),
        "utf8",
      );
      expect(decisionRoute).toContain("recordDecisionHandler");
      expect(decisionRoute).not.toMatch(/status\s*=\s*["']escalated["']/);
      expect(decisionRoute).not.toMatch(/supabase/i);

      const analyzeRoute = await readFile(
        new URL(
          "../../src/app/api/v1/cases/[id]/analyze/route.ts",
          import.meta.url,
        ),
        "utf8",
      );
      expect(analyzeRoute).toContain("analyzeCaseHandler");
      expect(analyzeRoute).not.toMatch(/openai|OpenAI/i);
    });
  });
});
