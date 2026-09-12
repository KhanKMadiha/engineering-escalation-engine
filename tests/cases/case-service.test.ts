import { beforeEach, describe, expect, it } from "vitest";
import {
  CaseNotFoundError,
  CaseService,
} from "@/lib/cases/case-service";
import { InvalidStatusTransitionError } from "@/lib/cases/status-machine";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
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
  logsErrors: "gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  affectedCustomerCount: 3,
};

describe("CaseService", () => {
  let service: CaseService;

  beforeEach(() => {
    service = new CaseService(new InMemoryCaseRepository());
  });

  it("creates a case in draft with a case_created audit event", async () => {
    const created = await service.createCase(sampleInput);
    expect(created.status).toBe("draft");

    const record = await service.getCaseById(created.id);
    expect(record.customer).toBe("Acme Corp");
    expect(record.events[0]?.eventType).toBe("case_created");
    expect(record.events[0]?.metadata).toMatchObject({
      status: "draft",
      severity: "high",
      environment: "production",
    });
  });

  it("retrieves a created case and lists summaries", async () => {
    const created = await service.createCase(sampleInput);
    const listed = await service.listCases();

    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
    expect(listed[0].environment).toBe("production");
    expect(listed[0].createdAt).toBeTruthy();

    await expect(service.getCaseById("missing")).rejects.toBeInstanceOf(
      CaseNotFoundError,
    );
  });

  it("applies valid status transitions and rejects invalid ones", async () => {
    const created = await service.createCase(sampleInput);
    const submitted = await service.transitionStatus(created.id, "submitted");
    expect(submitted.status).toBe("submitted");

    await expect(
      service.transitionStatus(created.id, "escalated"),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});
