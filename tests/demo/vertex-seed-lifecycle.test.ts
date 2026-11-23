import { beforeEach, describe, expect, it } from "vitest";
import { seedDemoCases } from "@/lib/demo/seed-demo-cases";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { resetRequestGuards } from "@/lib/security/request-guards";
import { buildCaseQueueStats } from "@/lib/ui/case-queue-stats";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";

/**
 * Regression: local memory seed must match production Vertex story —
 * approved with prepared handoff — while Orchid stays the ordinary
 * pending escalate review. Prevents Phase 1 queue screenshots from
 * showing two awaiting-approval escalate cases.
 */
describe("Vertex seed lifecycle alignment", () => {
  beforeEach(() => {
    resetRequestGuards();
  });

  it("seeds Vertex as escalated with handoff; only Orchid awaits ordinary escalate approval", async () => {
    const repository = new InMemoryCaseRepository();
    const result = await seedDemoCases({ repository });

    const vertex = result.seeded.find((row) => row.key === "http_504_latency");
    const orchid = result.seeded.find((row) => row.key === "saml_subset_users");
    expect(vertex).toBeDefined();
    expect(orchid).toBeDefined();

    expect(vertex?.status).toBe("escalated");
    expect(vertex?.recommendation).toBe("escalate");
    expect(orchid?.status).toBe("awaiting_decision");
    expect(orchid?.recommendation).toBe("escalate");

    const vertexRecord = await repository.getCaseWithDetails(vertex!.caseId);
    expect(vertexRecord?.decision?.decision).toBe("approved");
    expect(vertexRecord?.handoff).toBeTruthy();

    const listed = await repository.listCases();
    const stats = buildCaseQueueStats(listed);
    expect(stats.awaitingReview).toBe(1);

    const awaitingEscalate = listed.filter(
      (item) =>
        item.status === "awaiting_decision" &&
        item.escalationRecommendation === "escalate",
    );
    expect(awaitingEscalate).toHaveLength(1);
    expect(stripDemoMarkerPrefix(awaitingEscalate[0]!.customer)).toBe(
      "Orchid Health",
    );
    expect(
      listed.some(
        (item) =>
          stripDemoMarkerPrefix(item.customer) === "Vertex Media" &&
          item.status === "escalated",
      ),
    ).toBe(true);
  });
});
