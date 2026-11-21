import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_CASE_DEFINITIONS } from "@/lib/demo/demo-cases";
import {
  buildDemoEvidenceInputs,
  seedDemoTechnicalEvidenceForCase,
} from "@/lib/demo/demo-technical-evidence";
import { seedDemoCases } from "@/lib/demo/seed-demo-cases";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import {
  getInMemoryTechnicalEvidenceRepository,
  resetInMemoryTechnicalEvidenceRepository,
} from "@/lib/repositories/in-memory-technical-evidence-repository";
import { resetRequestGuards } from "@/lib/security/request-guards";

describe("Phase B technical evidence demo audit", () => {
  beforeEach(() => {
    resetRequestGuards();
    resetInMemoryTechnicalEvidenceRepository();
  });

  it("documents rich vs sparse coverage across all ten demo cases", async () => {
    const repo = new InMemoryCaseRepository();
    const result = await seedDemoCases({ repository: repo });
    const evidenceRepo = getInMemoryTechnicalEvidenceRepository();

    const rows = [];
    for (const definition of DEMO_CASE_DEFINITIONS) {
      const seeded = result.seeded.find((item) => item.key === definition.key);
      expect(seeded).toBeDefined();
      const items = await evidenceRepo.listByCaseId(seeded!.caseId);
      const types = items.map((item) => item.evidenceType);
      const withBody = items.filter((item) => (item.body ?? "").trim().length > 0);
      const withTs = items.filter((item) => Boolean(item.capturedAt));
      const withReq = items.filter((item) => Boolean(item.requestId));
      const screenshots = items.filter(
        (item) =>
          item.evidenceType === "screenshot" || item.attachments.length > 0,
      );
      const openable = screenshots.filter((item) =>
        item.attachments.some((attachment) => Boolean(attachment.id)),
      );

      rows.push({
        key: definition.key,
        count: items.length,
        types: [...new Set(types)].sort().join(", "),
        excerpts: withBody.length,
        timestamps: withTs.length,
        requestIds: withReq.length,
        sourceDemo: items.every((item) => item.source === "demo_fictional"),
        screenshots: screenshots.length,
        openableScreenshots: openable.length,
      });
    }

    // Sparse incomplete-investigation demos (intentional).
    expect(rows.find((row) => row.key === "insufficient_evidence")?.count).toBe(
      1,
    );
    expect(rows.find((row) => row.key === "continue_investigation")?.count).toBe(
      1,
    );
    expect(rows.find((row) => row.key === "scim_provisioning")?.count).toBe(1);

    // Rich showcase packages.
    expect(rows.find((row) => row.key === "clear_escalation")?.count).toBe(4);
    expect(rows.find((row) => row.key === "slack_notifications")?.count).toBe(4);
    expect(rows.find((row) => row.key === "saml_subset_users")?.count).toBe(4);
    expect(rows.find((row) => row.key === "http_504_latency")?.count).toBe(4);
    expect(rows.find((row) => row.key === "search_indexing")?.count).toBe(4);

    expect(
      rows.filter((row) => row.openableScreenshots > 0).length,
    ).toBeGreaterThanOrEqual(5);

    // Scores/status still match definitions (evidence must not alter engine outcomes).
    for (const definition of DEMO_CASE_DEFINITIONS) {
      const seeded = result.seeded.find((item) => item.key === definition.key);
      expect(seeded?.recommendation).toBe(definition.expectedRecommendation);
      expect(seeded?.status).toBe(definition.expectedStatus);
    }
  });

  it("refreshes outdated demo_fictional packages on reseed without touching case intake", async () => {
    const repo = new InMemoryCaseRepository();
    const evidence = getInMemoryTechnicalEvidenceRepository();
    const result = await seedDemoCases({ repository: repo });
    const slack = result.seeded.find((item) => item.key === "slack_notifications");
    expect(slack).toBeDefined();

    // Simulate an older sparse demo package.
    const existing = await evidence.listByCaseId(slack!.caseId);
    for (const item of existing) {
      await evidence.delete(item.id);
    }
    await evidence.create({
      caseId: slack!.caseId,
      evidenceType: "other",
      title: "[FICTIONAL DEMO] stale sparse note",
      body: "old",
      source: "demo_fictional",
      verificationStatus: "demo_fictional",
    });

    const refreshed = await seedDemoTechnicalEvidenceForCase({
      caseId: slack!.caseId,
      key: "slack_notifications",
      cases: repo,
      evidence,
    });
    expect(refreshed.refreshed).toBe(true);
    expect(refreshed.created).toBe(
      buildDemoEvidenceInputs(slack!.caseId, "slack_notifications").length,
    );
    const next = await evidence.listByCaseId(slack!.caseId);
    expect(next).toHaveLength(4);
    expect(next.some((item) => item.evidenceType === "screenshot")).toBe(true);
  });
});
