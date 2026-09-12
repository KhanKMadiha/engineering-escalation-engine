import { describe, expect, it } from "vitest";
import {
  generateEngineeringHandoff,
  HANDOFF_EVIDENCE_NOT_AVAILABLE,
  HANDOFF_NOT_ESTABLISHED,
  HANDOFF_NOT_PROVIDED,
} from "@/lib/handoff/generate-handoff";
import type {
  EscalationEngineResult,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
} from "@/types";

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
  status: "awaiting_decision",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
};

const analysis: StoredAnalysis = {
  id: "analysis-1",
  aiResult: {
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
    ],
    missingEvidence: ["HAR capture"],
    recommendedNextSteps: ["Collect more logs"],
    suspectedRootCause: null,
    aiEscalationAssessment: null,
  },
  validatedEvidence: [
    {
      description: "Timeout log",
      sourceField: "logsErrors",
      quotedExcerpt: "gateway timeout upstream",
    },
  ],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.5,
  model: "test",
  promptVersion: "v1",
  createdAt: "2026-09-05T10:00:00.000Z",
};

const engine: EscalationEngineResult = {
  escalationScore: 78,
  recommendation: "escalate",
  contributingFactors: [],
  recommendationReasons: ["Production impact"],
  source: "deterministic_engine",
};

const decision: HumanDecision = {
  id: "decision-1",
  caseId: "case-1",
  decision: "approved",
  rationale: "Reproducible in production and affecting multiple customers.",
  decidedAt: "2026-09-06T12:00:00.000Z",
  decidedBy: "support_engineer",
  escalationScoreAtDecision: 78,
  recommendationAtDecision: "escalate",
  source: "human_decision",
};

describe("generateEngineeringHandoff", () => {
  it("14–16. contains validated case, engine, and human decision data", () => {
    const handoff = generateEngineeringHandoff({
      caseRecord: supportCase,
      analysis,
      escalationResult: engine,
      decision,
      id: "handoff-fixed",
      createdAt: "2026-09-06T12:01:00.000Z",
    });

    expect(handoff.title).toBe("Checkout timeouts");
    expect(handoff.environment).toBe("production");
    expect(handoff.reportedSeverity).toBe("high");
    expect(handoff.evidence).toHaveLength(1);
    expect(handoff.evidence[0].quotedExcerpt).toBe("gateway timeout upstream");
    expect(handoff.evidence[0].source).toBe("extracted_evidence");
    expect(handoff.escalationScore).toBe(78);
    expect(handoff.escalationRecommendation).toBe("escalate");
    expect(handoff.decisionRationale).toContain("Reproducible in production");
    expect(handoff.source).toBe("engineering_handoff");
  });

  it("17–18. missing fields are explicit and evidence is not invented", () => {
    const handoff = generateEngineeringHandoff({
      caseRecord: {
        ...supportCase,
        stepsToReproduce: "",
        expectedBehaviour: "",
        actualBehaviour: "",
        troubleshootingPerformed: "",
        affectedCustomerCount: null,
      },
      analysis: {
        ...analysis,
        validatedEvidence: [],
        aiResult: {
          ...analysis.aiResult,
          evidenceIdentified: [],
          missingEvidence: [],
          suspectedRootCause: null,
          issueCategory: "unknown",
          reproducibility: "unknown",
        },
      },
      escalationResult: engine,
      decision,
      id: "handoff-2",
      createdAt: "2026-09-06T12:01:00.000Z",
    });

    expect(handoff.troubleshootingPerformed).toBe(HANDOFF_NOT_PROVIDED);
    expect(handoff.stepsToReproduce).toBe(HANDOFF_NOT_PROVIDED);
    expect(handoff.expectedBehaviour).toBe(HANDOFF_NOT_PROVIDED);
    expect(handoff.actualBehaviour).toBe(HANDOFF_NOT_PROVIDED);
    expect(handoff.suspectedRootCause).toBe(HANDOFF_NOT_ESTABLISHED);
    expect(handoff.missingEvidence).toEqual([HANDOFF_EVIDENCE_NOT_AVAILABLE]);
    expect(handoff.evidence).toEqual([]);
    expect(handoff.customerImpact).toContain(HANDOFF_NOT_PROVIDED);
  });

  it("19. handoff generation is deterministic for fixed ids/timestamps", () => {
    const a = generateEngineeringHandoff({
      caseRecord: supportCase,
      analysis,
      escalationResult: engine,
      decision,
      id: "handoff-fixed",
      createdAt: "2026-09-06T12:01:00.000Z",
    });
    const b = generateEngineeringHandoff({
      caseRecord: supportCase,
      analysis,
      escalationResult: engine,
      decision,
      id: "handoff-fixed",
      createdAt: "2026-09-06T12:01:00.000Z",
    });
    expect(a).toEqual(b);
  });
});
