import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listCasesHandler } from "@/lib/api/handlers/cases";
import { handleApiRequest } from "@/lib/api/http";
import { getCaseService } from "@/lib/cases/get-case-service";
import { seedDemoCases } from "@/lib/demo/seed-demo-cases";
import {
  getCaseRepository,
  resetCaseRepositoryCache,
} from "@/lib/repositories/get-case-repository";
import {
  getInMemoryCaseRepository,
  resetInMemoryCaseRepository,
} from "@/lib/repositories/in-memory-case-repository";
import { resetRequestGuards } from "@/lib/security/request-guards";

/**
 * Regression: demo seed, REST list, and dashboard listCases must share one
 * in-memory store (Next.js can duplicate module-scoped singletons across
 * RSC vs Route Handler graphs — globalThis anchors the store).
 */
describe("shared in-memory repository across demo seed / API / dashboard", () => {
  const previousRepo = process.env.CASE_REPOSITORY;

  beforeEach(() => {
    resetRequestGuards();
    process.env.CASE_REPOSITORY = "memory";
    resetCaseRepositoryCache();
    resetInMemoryCaseRepository();
  });

  afterEach(() => {
    if (previousRepo === undefined) {
      delete process.env.CASE_REPOSITORY;
    } else {
      process.env.CASE_REPOSITORY = previousRepo;
    }
    resetCaseRepositoryCache();
    resetInMemoryCaseRepository();
  });

  it("seed, API list, and dashboard CaseService observe the same repository state", async () => {
    const compositionRepo = getCaseRepository();
    const inMemorySingleton = getInMemoryCaseRepository();
    expect(compositionRepo).toBe(inMemorySingleton);

    const seeded = await seedDemoCases({ repository: getCaseRepository() });
    expect(seeded.seeded).toHaveLength(3);
    const seededIds = new Set(seeded.seeded.map((s) => s.caseId));

    // Same path as GET /api/v1/cases (default composition, no injected services).
    const apiResponse = await handleApiRequest(
      new Request("http://localhost/api/v1/cases", { method: "GET" }),
      "/api/v1/cases",
      (ctx) => listCasesHandler(ctx),
    );
    expect(apiResponse.status).toBe(200);
    const apiBody = (await apiResponse.json()) as {
      data: Array<{ id: string }>;
    };
    const apiIds = new Set(apiBody.data.map((c) => c.id));
    expect(apiIds).toEqual(seededIds);

    // Same path as src/app/page.tsx dashboard.
    const dashboardCases = await getCaseService().listCases();
    const dashboardIds = new Set(dashboardCases.map((c) => c.id));
    expect(dashboardIds).toEqual(seededIds);

    // Identity: composition root and in-memory singleton remain one instance.
    expect(getCaseRepository()).toBe(getInMemoryCaseRepository());
    expect(getCaseRepository()).toBe(compositionRepo);
  });
});
