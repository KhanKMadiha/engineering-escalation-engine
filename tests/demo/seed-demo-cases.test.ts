import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_CASE_DEFINITIONS,
  DEMO_CASE_MARKER,
} from "@/lib/demo/demo-cases";
import {
  assertDemoSeedAllowed,
  seedDemoCases,
} from "@/lib/demo/seed-demo-cases";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { resetRequestGuards } from "@/lib/security/request-guards";

describe("demo seed", () => {
  beforeEach(() => {
    resetRequestGuards();
  });

  it("requires ALLOW_DEMO_SEED=1", () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: "development" } as NodeJS.ProcessEnv),
    ).toThrow(/ALLOW_DEMO_SEED=1/);
  });

  it("blocks production unless ALLOW_DEMO_SEED=1", () => {
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "production",
        ALLOW_DEMO_SEED: "1",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow(/production/);
  });

  it("seeds three lifecycle-stage demo cases with valid workflow statuses", async () => {
    const repo = new InMemoryCaseRepository();
    const result = await seedDemoCases({ repository: repo });

    expect(result.seeded).toHaveLength(3);
    expect(result.skippedExistingTitles).toEqual([]);
    expect(result.leftoverDemoTitles).toEqual([]);

    const byKey = Object.fromEntries(result.seeded.map((s) => [s.key, s]));

    expect(byKey.clear_escalation.recommendation).toBe("escalate");
    expect(byKey.clear_escalation.status).toBe("escalated");
    expect(byKey.clear_escalation.escalationScore).toBe(98);

    expect(byKey.insufficient_evidence.recommendation).toBe(
      "insufficient_evidence",
    );
    expect(byKey.insufficient_evidence.status).toBe("awaiting_decision");
    expect(byKey.insufficient_evidence.escalationScore).toBe(20);

    expect(byKey.continue_investigation.recommendation).toBe(
      "continue_investigation",
    );
    expect(byKey.continue_investigation.status).toBe("investigation_continues");
    expect(byKey.continue_investigation.escalationScore).toBe(58);

    const clearRecord = await repo.getCaseWithDetails(
      byKey.clear_escalation.caseId,
    );
    const ssoRecord = await repo.getCaseWithDetails(
      byKey.insufficient_evidence.caseId,
    );
    const teamsRecord = await repo.getCaseWithDetails(
      byKey.continue_investigation.caseId,
    );

    expect(clearRecord?.product).toBe("API v3");
    expect(clearRecord?.customer).toContain("Northstar Financial");
    expect(clearRecord?.decision?.decision).toBe("approved");
    expect(clearRecord?.handoff).toBeDefined();
    expect(clearRecord?.createdAt).toBe("2026-09-08T11:30:00.000Z");
    expect(clearRecord?.decision?.decidedAt).toBe("2026-09-08T16:15:00.000Z");

    expect(ssoRecord?.product).toBe("SSO");
    expect(ssoRecord?.customer).toContain("Meridian Systems");
    expect(ssoRecord?.decision).toBeUndefined();
    expect(ssoRecord?.createdAt).toBe("2026-09-11T10:20:00.000Z");

    expect(teamsRecord?.product).toBe("MS Teams Integration");
    expect(teamsRecord?.customer).toContain("Apex Digital");
    expect(teamsRecord?.decision?.decision).toBe("rejected");
    expect(teamsRecord?.handoff).toBeUndefined();
    expect(teamsRecord?.createdAt).toBe("2026-09-12T09:15:00.000Z");
    expect(teamsRecord?.decision?.decidedAt).toBe("2026-09-12T14:40:00.000Z");

    const listed = await repo.listCases();
    expect(listed.map((item) => item.product)).toEqual([
      "MS Teams Integration",
      "SSO",
      "API v3",
    ]);

    for (const seededCase of [clearRecord, ssoRecord, teamsRecord]) {
      expect(seededCase).toBeDefined();
      expect(seededCase!.issueTitle).toContain(DEMO_CASE_MARKER);
      const events = [...seededCase!.events].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      expect(events[0]?.createdAt).toBe(seededCase!.createdAt);
      for (let i = 1; i < events.length; i += 1) {
        expect(events[i]!.createdAt >= events[i - 1]!.createdAt).toBe(true);
      }
      expect(seededCase!.updatedAt).toBe(events[events.length - 1]!.createdAt);
      if (seededCase!.incidentTimestamp) {
        expect(seededCase!.incidentTimestamp <= seededCase!.createdAt).toBe(
          true,
        );
      }
      if (seededCase!.analysis) {
        expect(seededCase!.analysis.createdAt >= seededCase!.createdAt).toBe(
          true,
        );
        expect(seededCase!.analysis.createdAt <= seededCase!.updatedAt).toBe(
          true,
        );
      }
      if (seededCase!.decision) {
        expect(
          seededCase!.decision.decidedAt >= seededCase!.analysis!.createdAt,
        ).toBe(true);
      }
    }
  });

  it("matches documented expected recommendations and statuses", async () => {
    const repo = new InMemoryCaseRepository();
    const result = await seedDemoCases({ repository: repo });
    for (const definition of DEMO_CASE_DEFINITIONS) {
      const seeded = result.seeded.find((s) => s.key === definition.key);
      expect(seeded?.recommendation).toBe(definition.expectedRecommendation);
      expect(seeded?.status).toBe(definition.expectedStatus);
    }
  });

  it("skips duplicate titles on re-seed", async () => {
    const repo = new InMemoryCaseRepository();
    const first = await seedDemoCases({ repository: repo });
    expect(first.seeded).toHaveLength(3);
    expect(first.staleSkipped).toEqual([]);

    const second = await seedDemoCases({ repository: repo });
    expect(second.seeded).toHaveLength(0);
    expect(second.skippedExistingTitles).toHaveLength(3);
    expect(second.staleSkipped).toEqual([]);
  });

  it("reports stale product when an existing demo title still stores Content API v3", async () => {
    const { CaseService } = await import("@/lib/cases/case-service");
    const repo = new InMemoryCaseRepository();
    const caseService = new CaseService(repo);
    const definition = DEMO_CASE_DEFINITIONS.find(
      (d) => d.key === "clear_escalation",
    );
    expect(definition).toBeDefined();

    await caseService.createCase({
      ...definition!.createInput,
      product: "Content API v3",
    });

    const result = await seedDemoCases({ repository: repo });
    expect(result.staleSkipped).toEqual([
      expect.objectContaining({
        key: "clear_escalation",
        existingProduct: "Content API v3",
        expectedProduct: "API v3",
        expectedCustomer: definition!.createInput.customer,
      }),
    ]);
    expect(result.seeded.map((s) => s.key).sort()).toEqual([
      "continue_investigation",
      "insufficient_evidence",
    ]);
  });

  it("reports stale customer when an existing demo title still stores Example Enterprise A", async () => {
    const { CaseService } = await import("@/lib/cases/case-service");
    const repo = new InMemoryCaseRepository();
    const caseService = new CaseService(repo);
    const definition = DEMO_CASE_DEFINITIONS.find(
      (d) => d.key === "clear_escalation",
    );
    expect(definition).toBeDefined();

    await caseService.createCase({
      ...definition!.createInput,
      customer: `${DEMO_CASE_MARKER} Example Enterprise A`,
    });

    const result = await seedDemoCases({ repository: repo });
    expect(result.staleSkipped).toEqual([
      expect.objectContaining({
        key: "clear_escalation",
        existingCustomer: `${DEMO_CASE_MARKER} Example Enterprise A`,
        expectedCustomer: `${DEMO_CASE_MARKER} Northstar Financial`,
        expectedProduct: "API v3",
      }),
    ]);
  });
});
