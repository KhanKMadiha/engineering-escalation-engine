import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_CASE_DEFINITIONS } from "@/lib/demo/demo-cases";
import { seedDemoCases } from "@/lib/demo/seed-demo-cases";
import { getInMemoryTechnicalEvidenceRepository } from "@/lib/repositories/in-memory-technical-evidence-repository";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import {
  caseMatchesReportedRange,
  caseMatchesSearch,
} from "@/lib/ui/case-queue-filters";
import { resetRequestGuards } from "@/lib/security/request-guards";

describe("expanded demo dataset", () => {
  beforeEach(() => {
    resetRequestGuards();
  });

  it("covers seven new issue themes with staggered months and Phase B evidence", async () => {
    const repo = new InMemoryCaseRepository();
    const result = await seedDemoCases({ repository: repo });
    expect(result.seeded).toHaveLength(10);

    const keys = result.seeded.map((item) => item.key);
    for (const key of [
      "slack_notifications",
      "api_rate_limit",
      "search_indexing",
      "saml_subset_users",
      "http_504_latency",
      "scim_provisioning",
      "email_delivery",
    ]) {
      expect(keys).toContain(key);
    }

    const listed = await repo.listCases();
    const months = new Set(listed.map((item) => item.createdAt.slice(0, 7)));
    expect(months.has("2026-01")).toBe(true);
    expect(months.has("2026-03")).toBe(true);
    expect(months.has("2026-04")).toBe(true);
    expect(months.has("2026-05")).toBe(true);
    expect(months.has("2026-06")).toBe(true);
    expect(months.has("2026-08")).toBe(true);
    expect(months.has("2026-09")).toBe(true);
    expect(months.has("2026-11")).toBe(true);

    const evidence = getInMemoryTechnicalEvidenceRepository();
    for (const seeded of result.seeded) {
      const items = await evidence.listByCaseId(seeded.caseId);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.source === "demo_fictional")).toBe(
        true,
      );
    }

    const now = new Date("2026-11-21T12:00:00.000Z");
    const allTime = listed.filter((item) =>
      caseMatchesReportedRange(item.createdAt, "all", now),
    );
    expect(allTime).toHaveLength(10);

    const last30 = listed.filter((item) =>
      caseMatchesReportedRange(item.createdAt, "30", now),
    );
    expect(last30.length).toBeLessThan(10);
    expect(last30.some((item) => item.createdAt.startsWith("2026-11"))).toBe(
      true,
    );
    const last90 = listed.filter((item) =>
      caseMatchesReportedRange(item.createdAt, "90", now),
    );
    expect(last90.some((item) => item.createdAt.startsWith("2026-09"))).toBe(
      true,
    );
    expect(last90.some((item) => item.createdAt.startsWith("2026-01"))).toBe(
      false,
    );

    expect(
      listed.some((item) => caseMatchesSearch(item, "Cascade Retail")),
    ).toBe(true);
    expect(
      listed.some((item) => caseMatchesSearch(item, "HTTP 504")),
    ).toBe(true);

    const pending = listed.filter(
      (item) => item.status === "awaiting_decision",
    );
    const handoffs = listed.filter((item) => item.status === "escalated");
    const continues = listed.filter(
      (item) => item.status === "investigation_continues",
    );
    // Orchid remains the ordinary pending escalate review; Vertex is pre-approved.
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(handoffs.length).toBeGreaterThanOrEqual(3);
    expect(continues.length).toBeGreaterThanOrEqual(2);

    for (const definition of DEMO_CASE_DEFINITIONS) {
      const seeded = result.seeded.find((item) => item.key === definition.key);
      expect(seeded?.recommendation).toBe(definition.expectedRecommendation);
      expect(seeded?.status).toBe(definition.expectedStatus);
    }

    // Snapshot engine scores (deterministic; not hardcoded into seed logic).
    const scoreByKey = Object.fromEntries(
      result.seeded.map((item) => [item.key, item.escalationScore]),
    );
    expect(scoreByKey).toMatchObject({
      clear_escalation: 98,
      insufficient_evidence: 20,
      continue_investigation: 58,
      search_indexing: 100,
      slack_notifications: 100,
      scim_provisioning: 20,
      api_rate_limit: 58,
      saml_subset_users: 98,
      email_delivery: 58,
      http_504_latency: 100,
    });
  });
});
