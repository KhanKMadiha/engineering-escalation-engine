import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDemoEvidenceInputs,
  seedDemoTechnicalEvidenceForCase,
} from "@/lib/demo/demo-technical-evidence";
import { CaseService } from "@/lib/cases/case-service";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";
import {
  getInMemoryCaseRepository,
  resetInMemoryCaseRepository,
} from "@/lib/repositories/in-memory-case-repository";
import {
  getInMemoryTechnicalEvidenceRepository,
  resetInMemoryTechnicalEvidenceRepository,
} from "@/lib/repositories/in-memory-technical-evidence-repository";

describe("demo technical evidence fixtures", () => {
  beforeEach(() => {
    resetInMemoryCaseRepository();
    resetInMemoryTechnicalEvidenceRepository();
  });

  it("labels clear_escalation artefacts as fictional demo", () => {
    const inputs = buildDemoEvidenceInputs(
      "11111111-1111-4111-8111-111111111111",
      "clear_escalation",
    );
    expect(inputs.length).toBeGreaterThanOrEqual(3);
    for (const input of inputs) {
      expect(input.source).toBe("demo_fictional");
      expect(input.title).toMatch(/FICTIONAL DEMO/i);
    }
  });

  it("seeds idempotently for a case", async () => {
    const cases = getInMemoryCaseRepository();
    const evidence = getInMemoryTechnicalEvidenceRepository();
    const caseService = new CaseService(cases);
    const validation = validateCreateCaseInput({
      customer: "[DEMO] Fixture Co",
      product: "API v3",
      severity: "high",
      issueTitle: "[DEMO] Evidence fixture case",
      issueDescription: "Fictional",
      environment: "production",
      stepsToReproduce: "1. Test",
      expectedBehaviour: "Ok",
      actualBehaviour: "Fail",
      troubleshootingPerformed: "None",
      logsErrors: "HTTP status: 500",
      requestIds: "req-demo-1",
      incidentTimestamp: null,
      issueFirstObserved: null,
      affectedCustomerCount: null,
    });
    if (!validation.success) {
      throw new Error(validation.formError);
    }
    const created = await caseService.createCase(validation.data);

    const first = await seedDemoTechnicalEvidenceForCase({
      caseId: created.id,
      key: "clear_escalation",
      cases,
      evidence,
    });
    const second = await seedDemoTechnicalEvidenceForCase({
      caseId: created.id,
      key: "clear_escalation",
      cases,
      evidence,
    });

    expect(first.skipped).toBe(false);
    expect(first.refreshed).toBe(false);
    expect(first.created).toBeGreaterThan(0);
    expect(second.skipped).toBe(true);
    expect(second.created).toBe(0);
    expect(second.refreshed).toBe(false);

    const listed = await evidence.listByCaseId(created.id);
    expect(listed.some((item) => item.evidenceType === "screenshot")).toBe(
      true,
    );
    expect(
      listed.some((item) => item.attachments.length > 0),
    ).toBe(true);
  });
});
