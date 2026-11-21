import { describe, expect, it } from "vitest";
import {
  normalizeCapturedAtInput,
  validateCreateTechnicalEvidence,
  validateEvidenceImageFile,
} from "@/lib/evidence/evidence-validators";

describe("evidence validators", () => {
  it("accepts a valid create payload", () => {
    const result = validateCreateTechnicalEvidence({
      caseId: "11111111-1111-4111-8111-111111111111",
      evidenceType: "api_response",
      title: "API response",
      body: '{"ok":false}',
      source: "support",
      capturedAt: "2026-09-08T09:14:32.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes datetime-local to ISO", () => {
    const normalized = normalizeCapturedAtInput("2026-09-08T09:14");
    expect(normalized).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(normalized?.endsWith("Z") || normalized?.includes("+")).toBe(true);
  });

  it("rejects disallowed image types", () => {
    expect(
      validateEvidenceImageFile({
        type: "application/pdf",
        size: 100,
        name: "a.pdf",
      }).ok,
    ).toBe(false);
  });
});
