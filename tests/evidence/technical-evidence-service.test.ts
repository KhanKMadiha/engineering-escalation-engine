import { beforeEach, describe, expect, it } from "vitest";
import { CaseService } from "@/lib/cases/case-service";
import { FICTIONAL_DEMO_PNG_BYTES } from "@/lib/demo/demo-technical-evidence";
import { TechnicalEvidenceService } from "@/lib/evidence/evidence-service";
import {
  getInMemoryCaseRepository,
  resetInMemoryCaseRepository,
} from "@/lib/repositories/in-memory-case-repository";
import {
  getInMemoryTechnicalEvidenceRepository,
  resetInMemoryTechnicalEvidenceRepository,
} from "@/lib/repositories/in-memory-technical-evidence-repository";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";

function makeServices() {
  const cases = getInMemoryCaseRepository();
  const evidence = getInMemoryTechnicalEvidenceRepository();
  return {
    cases,
    evidence,
    caseService: new CaseService(cases),
    evidenceService: new TechnicalEvidenceService(cases, evidence),
  };
}

async function createCase() {
  const { caseService } = makeServices();
  const validation = validateCreateCaseInput({
    customer: "Test Customer",
    product: "API v3",
    severity: "high",
    issueTitle: "Evidence service test case",
    issueDescription: "Test description for evidence CRUD.",
    environment: "production",
    stepsToReproduce: "1. Open\n2. Observe",
    expectedBehaviour: "Success",
    actualBehaviour: "Failure",
    troubleshootingPerformed: "Checked logs",
    logsErrors: "HTTP status: 500",
    requestIds: "req-test-1",
    incidentTimestamp: null,
    issueFirstObserved: null,
    affectedCustomerCount: null,
  });
  if (!validation.success) {
    throw new Error(validation.formError);
  }
  return caseService.createCase(validation.data);
}

describe("TechnicalEvidenceService", () => {
  beforeEach(() => {
    resetInMemoryCaseRepository();
    resetInMemoryTechnicalEvidenceRepository();
  });

  it("supports multiple evidence records per case", async () => {
    const { evidenceService } = makeServices();
    const record = await createCase();

    await evidenceService.create({
      caseId: record.id,
      evidenceType: "api_response",
      title: "API 500 response",
      body: "HTTP/1.1 500",
      source: "support",
    });
    await evidenceService.create({
      caseId: record.id,
      evidenceType: "datadog_log",
      title: "Datadog excerpt",
      body: "ERROR article-service",
      source: "support",
      verificationStatus: "unverified",
    });

    const listed = await evidenceService.listForCase(record.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.evidenceType).sort()).toEqual([
      "api_response",
      "datadog_log",
    ]);
  });

  it("persists evidence independently of case analysis fields", async () => {
    const { evidenceService, caseService } = makeServices();
    const record = await createCase();
    await evidenceService.create({
      caseId: record.id,
      evidenceType: "application_log",
      title: "App log",
      body: "error line",
      source: "support",
    });

    // Evidence lives outside case_analyses / intake logsErrors.
    const refreshed = await caseService.getCaseById(record.id);
    expect(refreshed.logsErrors).toContain("500");
    const listed = await evidenceService.listForCase(record.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.body).toBe("error line");
    expect(listed[0]?.body).not.toBe(refreshed.logsErrors);
  });

  it("rejects invalid screenshot types and oversized files", async () => {
    const { evidenceService } = makeServices();
    const record = await createCase();
    const evidence = await evidenceService.create({
      caseId: record.id,
      evidenceType: "screenshot",
      title: "Screenshot slot",
      source: "support",
    });

    await expect(
      evidenceService.addScreenshot({
        caseId: record.id,
        evidenceId: evidence.id,
        fileName: "notes.txt",
        contentType: "text/plain",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow(/PNG|JPEG|WebP/i);

    await expect(
      evidenceService.addScreenshot({
        caseId: record.id,
        evidenceId: evidence.id,
        fileName: "huge.png",
        contentType: "image/png",
        bytes: new Uint8Array(5 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow(/5 MB/i);
  });

  it("prevents cross-case attachment access", async () => {
    const { evidenceService } = makeServices();
    const a = await createCase();
    const b = await createCase();
    const evidence = await evidenceService.create({
      caseId: a.id,
      evidenceType: "screenshot",
      title: "Owned by A",
      source: "support",
    });
    const attachment = await evidenceService.addScreenshot({
      caseId: a.id,
      evidenceId: evidence.id,
      fileName: "fictional-demo.png",
      contentType: "image/png",
      bytes: FICTIONAL_DEMO_PNG_BYTES,
    });

    await expect(
      evidenceService.downloadAttachmentForCase(b.id, attachment.id),
    ).rejects.toThrow();
  });

  it("records audit events for create and delete", async () => {
    const { evidenceService, caseService } = makeServices();
    const record = await createCase();
    const evidence = await evidenceService.create({
      caseId: record.id,
      evidenceType: "other",
      title: "Note",
      body: "body",
      source: "customer",
      verificationStatus: "unverified",
    });
    await evidenceService.delete(record.id, evidence.id);

    const refreshed = await caseService.getCaseById(record.id);
    const types = refreshed.events.map((event) => event.eventType);
    expect(types).toContain("technical_evidence_added");
    expect(types).toContain("technical_evidence_deleted");
  });

  it("rejects evidence for unknown cases", async () => {
    const { evidenceService } = makeServices();
    await expect(
      evidenceService.create({
        caseId: "00000000-0000-4000-8000-000000000099",
        evidenceType: "other",
        title: "Orphan",
        source: "support",
      }),
    ).rejects.toThrow(/not found/i);
  });
});
