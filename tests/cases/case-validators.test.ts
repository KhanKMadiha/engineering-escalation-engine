import { describe, expect, it } from "vitest";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";

const validInput = {
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
  issueFirstObserved: null,
  affectedCustomerCount: 3,
};

describe("validateCreateCaseInput", () => {
  it("accepts a valid case", () => {
    const result = validateCreateCaseInput(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer).toBe("Acme Corp");
      expect(result.data.severity).toBe("high");
      expect(result.data.environment).toBe("production");
      expect(result.data.affectedCustomerCount).toBe(3);
      expect(result.data.incidentTimestamp).toBe("2026-09-05T10:00:00.000Z");
      expect(result.data.issueFirstObserved).toBeNull();
    }
  });

  it("accepts approximate issue-first-observed text without inventing a timestamp", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      incidentTimestamp: "",
      issueFirstObserved: "Approximately 2 hours ago",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.incidentTimestamp).toBeNull();
      expect(result.data.issueFirstObserved).toBe("Approximately 2 hours ago");
    }
  });

  it("rejects free text in incidentTimestamp", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      incidentTimestamp: "This morning",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.incidentTimestamp?.[0]).toMatch(/date\/time/i);
    }
  });

  it("rejects a missing required field", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      customer: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.customer?.[0]).toMatch(/required/i);
    }
  });

  it("rejects an invalid severity", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      severity: "urgent",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.severity?.[0]).toMatch(/severity/i);
    }
  });

  it("rejects an invalid environment", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      environment: "qa",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.environment?.[0]).toMatch(/environment/i);
    }
  });

  it("rejects an invalid affected customer count", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      affectedCustomerCount: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.affectedCustomerCount?.[0]).toMatch(
        /whole number/i,
      );
    }
  });

  it("allows empty optional fields", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      stepsToReproduce: "",
      expectedBehaviour: "",
      actualBehaviour: "",
      incidentTimestamp: "",
      issueFirstObserved: "",
      affectedCustomerCount: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.incidentTimestamp).toBeNull();
      expect(result.data.issueFirstObserved).toBeNull();
      expect(result.data.affectedCustomerCount).toBeNull();
      expect(result.data.stepsToReproduce).toBe("");
      expect(result.data.expectedBehaviour).toBe("");
      expect(result.data.actualBehaviour).toBe("");
    }
  });

  it("rejects non-string reproduction fields", () => {
    const result = validateCreateCaseInput({
      ...validInput,
      stepsToReproduce: 123,
    });
    expect(result.success).toBe(false);
  });
});
