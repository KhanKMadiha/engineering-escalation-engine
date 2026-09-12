import { describe, expect, it } from "vitest";

/**
 * Live Supabase integration tests are opt-in.
 * They must never run against arbitrary production data by default.
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Without configuration, this suite documents the limitation and skips.
 */
const enabled =
  process.env.RUN_SUPABASE_INTEGRATION === "1" &&
  Boolean(process.env.SUPABASE_URL?.trim()) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

describe.skipIf(!enabled)("Phase 7 Supabase integration (opt-in)", () => {
  it("creates, loads, and lists a case against configured Supabase", async () => {
    const { createSupabaseCaseRepository } = await import(
      "@/lib/supabase/supabase-case-repository"
    );
    const repo = createSupabaseCaseRepository();
    const created = await repo.createCase({
      customer: "Integration Test Customer",
      product: "Payments API",
      severity: "low",
      issueTitle: `Phase7 integration ${Date.now()}`,
      issueDescription: "Temporary integration probe — safe to delete.",
      environment: "development",
      stepsToReproduce: "",
      expectedBehaviour: "n/a",
      actualBehaviour: "n/a",
      troubleshootingPerformed: "n/a",
      logsErrors: "n/a",
      requestIds: "n/a",
    });

    const loaded = await repo.getCaseById(created.id);
    expect(loaded?.id).toBe(created.id);

    const listed = await repo.listCases({ status: "draft" });
    expect(listed.some((c) => c.id === created.id)).toBe(true);
  });
});

describe("Phase 7 Supabase integration gate", () => {
  it("skips live tests clearly when integration config is missing", () => {
    if (!enabled) {
      expect(enabled).toBe(false);
      // Documented limitation: no live Supabase in default CI/local runs.
      expect(process.env.RUN_SUPABASE_INTEGRATION ?? "").not.toBe("1");
    } else {
      expect(enabled).toBe(true);
    }
  });
});
