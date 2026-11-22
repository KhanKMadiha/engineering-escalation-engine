import { describe, expect, it } from "vitest";
import {
  assertCanCloneDemoTemplate,
  assertTemplateEligibleForInteractiveFork,
  assertTemplateImmutableForMutation,
  assertWorkspaceOwnsCase,
  DemoCaseAccessError,
} from "@/lib/demo/demo-case-access";
import type { CaseRecord, EscalationHandoff } from "@/types";

const approvedHandoff: EscalationHandoff = {
  id: "h1",
  caseId: "case-1",
  title: "t",
  summary: "s",
  customerImpact: "i",
  environment: "production",
  reportedSeverity: "high",
  affectedCustomerCount: 1,
  issueCategory: "bug",
  stepsToReproduce: "",
  expectedBehaviour: "",
  actualBehaviour: "",
  reproducibility: "confirmed",
  troubleshootingPerformed: "",
  evidence: [],
  missingEvidence: [],
  suspectedRootCause: "n",
  escalationScore: 100,
  escalationRecommendation: "escalate",
  decisionRationale: "ok",
  createdAt: "2026-09-11T12:00:00.000Z",
  source: "engineering_handoff",
};

function baseCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "case-1",
    customer: "Meridian Systems",
    product: "SSO",
    severity: "medium",
    issueTitle: "SSO failure",
    issueDescription: "desc",
    environment: "production",
    stepsToReproduce: "",
    expectedBehaviour: "",
    actualBehaviour: "",
    troubleshootingPerformed: "",
    logsErrors: "",
    requestIds: "",
    incidentTimestamp: null,
    issueFirstObserved: null,
    affectedCustomerCount: 1,
    status: "awaiting_decision",
    createdAt: "2026-09-11T10:00:00.000Z",
    updatedAt: "2026-09-11T10:00:00.000Z",
    events: [],
    escalationResult: {
      escalationScore: 75,
      recommendation: "escalate",
      contributingFactors: [],
      recommendationReasons: [],
      source: "deterministic_engine",
    },
    ...overrides,
  };
}

describe("demo case access rules", () => {
  it("blocks mutations on shared templates", () => {
    expect(() =>
      assertTemplateImmutableForMutation(baseCase({ demoWorkspaceId: null })),
    ).toThrow(DemoCaseAccessError);
  });

  it("enforces workspace ownership on forks", () => {
    const fork = baseCase({
      demoWorkspaceId: "ws-a",
      clonedFromCaseId: "template-1",
    });
    expect(() => assertWorkspaceOwnsCase(fork, "ws-a")).not.toThrow();
    expect(() => assertWorkspaceOwnsCase(fork, "ws-b")).toThrow(
      /not available/i,
    );
  });

  it("allows interactive fork only for escalation-ready awaiting templates", () => {
    expect(() =>
      assertTemplateEligibleForInteractiveFork(baseCase()),
    ).not.toThrow();

    expect(() =>
      assertTemplateEligibleForInteractiveFork(
        baseCase({
          escalationResult: {
            escalationScore: 20,
            recommendation: "insufficient_evidence",
            contributingFactors: [],
            recommendationReasons: [],
            source: "deterministic_engine",
          },
        }),
      ),
    ).toThrow(DemoCaseAccessError);

    expect(() =>
      assertTemplateEligibleForInteractiveFork(
        baseCase({
          status: "escalated",
          handoff: approvedHandoff,
        }),
      ),
    ).toThrow(/original handoff/i);
  });

  it("allows cloning shared templates, including approved ones", () => {
    expect(() => assertCanCloneDemoTemplate(baseCase())).not.toThrow();
    expect(() =>
      assertCanCloneDemoTemplate(
        baseCase({ status: "escalated", handoff: approvedHandoff }),
      ),
    ).not.toThrow();
    expect(() =>
      assertCanCloneDemoTemplate(
        baseCase({ demoWorkspaceId: "ws-a", clonedFromCaseId: "template-1" }),
      ),
    ).toThrow(DemoCaseAccessError);
  });
});
