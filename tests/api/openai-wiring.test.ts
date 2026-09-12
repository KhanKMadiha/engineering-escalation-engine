import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  analyzeCaseHandler,
  getCaseHandler,
  listCasesHandler,
} from "@/lib/api/handlers/cases";
import { handleApiRequest } from "@/lib/api/http";
import { getDefaultApiServices } from "@/lib/api/services";
import { resetCaseRepositoryCache } from "@/lib/repositories/get-case-repository";
import { getInMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
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

function jsonRequest(method: string, url: string): Request {
  return new Request(url, { method });
}

async function readJson(response: Response) {
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

describe("API composition without OPENAI_API_KEY", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousRepo = process.env.CASE_REPOSITORY;

  beforeEach(() => {
    resetRequestGuards();
    delete process.env.OPENAI_API_KEY;
    process.env.CASE_REPOSITORY = "memory";
    resetCaseRepositoryCache();
    getInMemoryCaseRepository().clear();
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
    if (previousRepo === undefined) {
      delete process.env.CASE_REPOSITORY;
    } else {
      process.env.CASE_REPOSITORY = previousRepo;
    }
    resetCaseRepositoryCache();
  });

  it("GET /api/v1/cases works without OPENAI_API_KEY", async () => {
    const services = getDefaultApiServices();
    await services.caseService.createCase(sampleInput);

    const response = await handleApiRequest(
      jsonRequest("GET", "http://localhost/api/v1/cases"),
      "/api/v1/cases",
      (ctx) => listCasesHandler(ctx),
    );
    const body = await readJson(response);
    expect(body.status).toBe(200);
    expect(Array.isArray(body.body.data)).toBe(true);
    expect((body.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/v1/cases/:id works without OPENAI_API_KEY", async () => {
    const services = getDefaultApiServices();
    const created = await services.caseService.createCase(sampleInput);

    const response = await handleApiRequest(
      jsonRequest("GET", `http://localhost/api/v1/cases/${created.id}`),
      "/api/v1/cases/:id",
      (ctx) => getCaseHandler(ctx),
      { id: created.id },
    );
    const body = await readJson(response);
    expect(body.status).toBe(200);
    expect((body.body.data as { id: string }).id).toBe(created.id);
  });

  it("analysis fails safely when OPENAI_API_KEY is missing", async () => {
    const services = getDefaultApiServices();
    const created = await services.caseService.createCase(sampleInput);

    const response = await handleApiRequest(
      jsonRequest(
        "POST",
        `http://localhost/api/v1/cases/${created.id}/analyze`,
      ),
      "/api/v1/cases/:id/analyze",
      (ctx) => analyzeCaseHandler(ctx),
      { id: created.id },
    );
    const body = await readJson(response);
    expect(body.status).toBe(502);
    expect((body.body.error as { code: string }).code).toBe("ANALYSIS_FAILED");
    expect(JSON.stringify(body.body)).not.toMatch(/sk-/);
  });
});
