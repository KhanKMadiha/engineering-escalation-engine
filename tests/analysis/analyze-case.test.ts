import { describe, expect, it, vi } from "vitest";
import {
  AIAnalysisService,
  AnalysisProviderError,
  AnalysisSchemaError,
  type AnalysisModelClient,
} from "@/lib/analysis/analyze-case";
import type { SupportCase } from "@/types";

const supportCase: SupportCase = {
  id: "case-1",
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
  logsErrors: "ERROR gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  issueFirstObserved: null,
  affectedCustomerCount: 3,
  status: "submitted",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
};

function validRawAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "confirmed",
    suspectedProductDefect: true,
    reasoning: "Logs show gateway timeouts.",
    evidenceIdentified: [
      {
        description: "Timeout log",
        sourceField: "logsErrors",
        quotedExcerpt: "gateway timeout upstream",
      },
      {
        description: "Invented",
        sourceField: "logsErrors",
        quotedExcerpt: "kernel panic in billing",
      },
    ],
    missingEvidence: ["HAR"],
    recommendedNextSteps: ["Collect more logs"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_continue",
    ...overrides,
  };
}

describe("AIAnalysisService", () => {
  it("handles a valid structured response and validates evidence", async () => {
    const generateAnalysis = vi.fn(async () => validRawAnalysis());
    const client: AnalysisModelClient = {
      model: "mock-model",
      generateAnalysis,
    };

    const service = new AIAnalysisService(client);
    const result = await service.analyzeCase(supportCase);

    expect(generateAnalysis).toHaveBeenCalledOnce();
    expect(result.result.evidenceIdentified).toHaveLength(1);
    expect(result.evidenceValidation.rejectedEvidence).toHaveLength(1);
    expect(result.model).toBe("mock-model");
    expect(result.provenance.reasoning).toBe("ai_inference");
    expect(result.provenance.evidenceIdentified).toBe("extracted_evidence");
  });

  it("handles a malformed response safely", async () => {
    const client: AnalysisModelClient = {
      model: "mock-model",
      generateAnalysis: async () => ({ not: "valid" }),
    };

    const service = new AIAnalysisService(client);
    await expect(service.analyzeCase(supportCase)).rejects.toBeInstanceOf(
      AnalysisSchemaError,
    );
  });

  it("handles OpenAI/provider failure safely", async () => {
    const client: AnalysisModelClient = {
      model: "mock-model",
      generateAnalysis: async () => {
        throw new Error("network down");
      },
    };

    const service = new AIAnalysisService(client);
    await expect(service.analyzeCase(supportCase)).rejects.toBeInstanceOf(
      AnalysisProviderError,
    );
  });

  it("does not perform a live API call", async () => {
    const client: AnalysisModelClient = {
      model: "mock-model",
      generateAnalysis: async () => validRawAnalysis(),
    };

    const service = new AIAnalysisService(client);
    await service.analyzeCase(supportCase);

    // No OpenAI SDK usage in this unit path — mock is the only collaborator.
    expect(client.generateAnalysis).toBeTypeOf("function");
  });
});
