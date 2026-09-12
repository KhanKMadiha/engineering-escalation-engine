import { describe, expect, it } from "vitest";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";
import { buildEscalationSignals } from "@/lib/escalation/signal-builder";
import { evaluateEscalation } from "@/lib/escalation/escalation-engine";
import {
  generateEngineeringHandoff,
  HANDOFF_NOT_PROVIDED,
} from "@/lib/handoff/generate-handoff";
import { openApiDocument } from "@/lib/api/openapi";
import { toCaseResponse, toHandoffResponse } from "@/lib/api/serializers";
import {
  createCaseHandler,
  getCaseHandler,
} from "@/lib/api/handlers/cases";
import { handleApiRequest } from "@/lib/api/http";
import { createApiServices } from "@/lib/api/services";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import {
  analysisToRow,
  analysisFromRow,
  supportCaseFromRow,
  supportCaseToInsert,
} from "@/lib/supabase/mappers";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/analysis/prompts";
import type {
  CreateCaseInput,
  EscalationEngineResult,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
} from "@/types";

const baseInput: CreateCaseInput = {
  customer: "Acme Corp",
  product: "Payments API",
  severity: "high",
  issueTitle: "Checkout timeouts",
  issueDescription: "Customers report 504s during checkout.",
  environment: "production",
  stepsToReproduce: "",
  expectedBehaviour: "",
  actualBehaviour: "",
  troubleshootingPerformed: "Checked gateway status page.",
  logsErrors: "ERROR gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  issueFirstObserved: null,
  affectedCustomerCount: 3,
};

const analysis: StoredAnalysis = {
  id: "11111111-1111-4111-8111-111111111111",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "unknown",
    suspectedProductDefect: true,
    reasoning: "Logs show gateway timeouts.",
    evidenceIdentified: [],
    missingEvidence: ["Confirmed reproduction"],
    recommendedNextSteps: ["Reproduce with the documented steps"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_continue",
  },
  validatedEvidence: [],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.2,
  provenance: {
    reproducibility: "ai_inference",
    stepsToReproduce: "customer_provided",
    expectedBehaviour: "customer_provided",
    actualBehaviour: "customer_provided",
  },
  model: "test-model",
  promptVersion: "v1.2",
  createdAt: "2026-09-06T10:00:00.000Z",
};

const engine: EscalationEngineResult = {
  escalationScore: 50,
  recommendation: "continue_investigation",
  contributingFactors: [],
  recommendationReasons: ["Insufficient confirmed reproduction"],
  source: "deterministic_engine",
};

const decision: HumanDecision = {
  id: "22222222-2222-4222-8222-222222222222",
  caseId: "33333333-3333-4333-8333-333333333333",
  decision: "approved",
  rationale: "Need engineering review despite incomplete reproduction.",
  decidedAt: "2026-09-06T12:00:00.000Z",
  decidedBy: "support_engineer",
  escalationScoreAtDecision: 50,
  recommendationAtDecision: "continue_investigation",
  source: "human_decision",
};

describe("Reproduction / behaviour fields", () => {
  it("1–2. creates with and without reproduction steps", () => {
    const withSteps = validateCreateCaseInput({
      ...baseInput,
      stepsToReproduce: "1. Navigate to checkout\n2. Submit payment",
      expectedBehaviour: "Completes quickly",
      actualBehaviour: "Times out",
    });
    expect(withSteps.success).toBe(true);
    if (withSteps.success) {
      expect(withSteps.data.stepsToReproduce).toContain("Navigate");
    }

    const without = validateCreateCaseInput({
      ...baseInput,
      stepsToReproduce: undefined,
      expectedBehaviour: undefined,
      actualBehaviour: undefined,
    });
    expect(without.success).toBe(true);
    if (without.success) {
      expect(without.data.stepsToReproduce).toBe("");
      expect(without.data.expectedBehaviour).toBe("");
      expect(without.data.actualBehaviour).toBe("");
    }
  });

  it("3–6. persists and round-trips; missing fields load as empty", async () => {
    const repo = new InMemoryCaseRepository();
    const created = await repo.createCase({
      ...baseInput,
      stepsToReproduce: "1. Open app\n2. Trigger failure",
      expectedBehaviour: "Success",
      actualBehaviour: "Failure",
    });
    expect(created.stepsToReproduce).toContain("Open app");
    expect(created.expectedBehaviour).toBe("Success");
    expect(created.actualBehaviour).toBe("Failure");

    const loaded = await repo.getCaseById(created.id);
    expect(loaded?.stepsToReproduce).toBe(created.stepsToReproduce);
    expect(loaded?.expectedBehaviour).toBe("Success");

    const empty = await repo.createCase(baseInput);
    expect(empty.stepsToReproduce).toBe("");
    expect(empty.expectedBehaviour).toBe("");

    const row = supportCaseToInsert(
      "33333333-3333-4333-8333-333333333333",
      {
        ...baseInput,
        stepsToReproduce: "1. Step",
        expectedBehaviour: "OK",
        actualBehaviour: "Bad",
      },
      "draft",
      "2026-09-06T09:00:00.000Z",
      "2026-09-06T09:00:00.000Z",
    );
    expect(row.steps_to_reproduce).toBe("1. Step");
    const legacyRow = {
      ...row,
      steps_to_reproduce: null,
      expected_behaviour: null,
      actual_behaviour: null,
    };
    const fromLegacy = supportCaseFromRow(legacyRow);
    expect(fromLegacy.stepsToReproduce).toBe("");
    expect(fromLegacy.expectedBehaviour).toBe("");
    expect(fromLegacy.actualBehaviour).toBe("");
  });

  it("7–9. provenance preserved; AI prompt forbids inventing steps; missing is safe", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(/stepsToReproduce/i);
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(/do not invent them/i);
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(
      /Documented reproduction steps do NOT automatically/i,
    );

    const mapped = analysisFromRow(analysisToRow("case-1", analysis));
    expect(mapped.provenance?.stepsToReproduce).toBe("customer_provided");
    expect(mapped.provenance?.reproducibility).toBe("ai_inference");
  });

  it("10–11. confirmed reproduction uses existing signal; steps alone do not confirm", () => {
    const caseWithSteps: SupportCase = {
      id: "case-1",
      ...baseInput,
      stepsToReproduce: "1. Do the thing\n2. See the error",
      expectedBehaviour: "Works",
      actualBehaviour: "Fails",
      incidentTimestamp: baseInput.incidentTimestamp ?? null,
      issueFirstObserved: null,
      affectedCustomerCount: baseInput.affectedCustomerCount ?? null,
      status: "analyzing",
      createdAt: "2026-09-06T00:00:00.000Z",
      updatedAt: "2026-09-06T00:00:00.000Z",
    };

    const unknownSignals = buildEscalationSignals(caseWithSteps, {
      result: analysis.aiResult,
      evidenceValidation: {
        validatedEvidence: [],
        rejectedEvidence: [],
        warnings: [],
        evidenceCompletenessScore: 0.2,
      },
    });
    expect(unknownSignals.reproducibility).toBe("unknown");
    const unknownResult = evaluateEscalation(unknownSignals);
    expect(
      unknownResult.contributingFactors.some(
        (f) => f.signal === "confirmed_reproducibility",
      ),
    ).toBe(false);

    const confirmedSignals = buildEscalationSignals(caseWithSteps, {
      result: { ...analysis.aiResult, reproducibility: "confirmed" },
      evidenceValidation: {
        validatedEvidence: [],
        rejectedEvidence: [],
        warnings: [],
        evidenceCompletenessScore: 0.2,
      },
    });
    const confirmedResult = evaluateEscalation(confirmedSignals);
    expect(
      confirmedResult.contributingFactors.some(
        (f) => f.signal === "confirmed_reproducibility",
      ),
    ).toBe(true);
  });

  it("12–13. handoff includes reproduction fields with placeholders", () => {
    const withData = generateEngineeringHandoff({
      caseRecord: {
        id: decision.caseId,
        ...baseInput,
        stepsToReproduce: "1. Reproduce",
        expectedBehaviour: "OK",
        actualBehaviour: "Error",
        incidentTimestamp: null,
        issueFirstObserved: null,
        affectedCustomerCount: null,
        status: "awaiting_decision",
        createdAt: "2026-09-06T00:00:00.000Z",
        updatedAt: "2026-09-06T00:00:00.000Z",
      },
      analysis,
      escalationResult: engine,
      decision,
    });
    expect(withData.stepsToReproduce).toBe("1. Reproduce");
    expect(withData.expectedBehaviour).toBe("OK");
    expect(withData.actualBehaviour).toBe("Error");
    expect(withData.reproducibility).toBe("unknown");

    const missing = generateEngineeringHandoff({
      caseRecord: {
        id: decision.caseId,
        ...baseInput,
        incidentTimestamp: null,
        issueFirstObserved: null,
        affectedCustomerCount: null,
        status: "awaiting_decision",
        createdAt: "2026-09-06T00:00:00.000Z",
        updatedAt: "2026-09-06T00:00:00.000Z",
      },
      analysis,
      escalationResult: engine,
      decision,
    });
    expect(missing.stepsToReproduce).toBe(HANDOFF_NOT_PROVIDED);
    expect(missing.expectedBehaviour).toBe(HANDOFF_NOT_PROVIDED);
    expect(missing.actualBehaviour).toBe(HANDOFF_NOT_PROVIDED);
  });

  it("14–16. REST API accepts/returns fields; OpenAPI documents them", async () => {
    const services = createApiServices({
      repository: new InMemoryCaseRepository(),
    });
    const created = await handleApiRequest(
      new Request("http://localhost/api/v1/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...baseInput,
          stepsToReproduce: "1. Step one",
          expectedBehaviour: "Expected",
          actualBehaviour: "Actual",
        }),
      }),
      "/api/v1/cases",
      (ctx) => createCaseHandler(ctx, services),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      data: ReturnType<typeof toCaseResponse>;
    };
    expect(createdBody.data.stepsToReproduce).toBe("1. Step one");
    expect(createdBody.data.expectedBehaviour).toBe("Expected");
    expect(createdBody.data.actualBehaviour).toBe("Actual");

    const got = await handleApiRequest(
      new Request(`http://localhost/api/v1/cases/${createdBody.data.id}`),
      "/api/v1/cases/:id",
      (ctx) => getCaseHandler(ctx, services),
      { id: createdBody.data.id },
    );
    const gotBody = (await got.json()) as {
      data: ReturnType<typeof toCaseResponse>;
    };
    expect(gotBody.data.stepsToReproduce).toBe("1. Step one");

    const schema = openApiDocument.components.schemas.CreateCaseRequest;
    expect(schema.properties).toHaveProperty("stepsToReproduce");
    expect(schema.required).not.toContain("stepsToReproduce");
    expect(schema.required).not.toContain("expectedBehaviour");
    expect(schema.required).not.toContain("actualBehaviour");

    const handoffDto = toHandoffResponse(
      generateEngineeringHandoff({
        caseRecord: {
          id: decision.caseId,
          ...baseInput,
          stepsToReproduce: "1. Step",
          expectedBehaviour: "E",
          actualBehaviour: "A",
          incidentTimestamp: null,
          issueFirstObserved: null,
          affectedCustomerCount: null,
          status: "escalated",
          createdAt: "2026-09-06T00:00:00.000Z",
          updatedAt: "2026-09-06T00:00:00.000Z",
        },
        analysis,
        escalationResult: engine,
        decision,
      }),
    );
    expect(handoffDto.stepsToReproduce).toBe("1. Step");
    expect(handoffDto.provenanceNotes.customerProvided).toContain(
      "stepsToReproduce",
    );
  });
});
