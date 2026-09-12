import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { caseDetailTwoColumnGridClassName } from "@/components/cases/CaseDetailTwoColumnLayout";
import { HandoffTab } from "@/components/cases/tabs/HandoffTab";
import {
  buildDemoJiraKey,
  buildDemoRootlyId,
  canCreateDownstreamDemo,
  createDemoJiraEscalation,
  createDemoRootlyIncident,
  severityToJiraPriority,
} from "@/lib/demo/downstream-demo";
import type {
  CaseRecord,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
} from "@/types";

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "confirmed",
    suspectedProductDefect: true,
    reasoning: "Advisory reasoning",
    evidenceIdentified: [],
    missingEvidence: [],
    recommendedNextSteps: [],
    suspectedRootCause: "Upstream failure",
    aiEscalationAssessment: "likely_escalate",
  },
  validatedEvidence: [
    {
      description: "HTTP 500 in logs",
      sourceField: "logsErrors",
      quotedExcerpt: "HTTP status: 500",
    },
  ],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.8,
  analysisWarnings: [],
  model: "demo-model",
  promptVersion: "1.2",
  createdAt: "2026-09-10T19:09:00.000Z",
};

const escalation: EscalationEngineResult = {
  escalationScore: 98,
  recommendation: "escalate",
  contributingFactors: [],
  recommendationReasons: ["Strong evidence"],
  source: "deterministic_engine",
};

const handoff: EscalationHandoff = {
  id: "ho-stable-1",
  caseId: "11111111-1111-4111-8111-111111111111",
  title: "[DEMO] Intermittent 500 errors",
  summary: "Customers cannot retrieve articles.",
  customerImpact: "3 customers affected",
  environment: "production",
  reportedSeverity: "high",
  affectedCustomerCount: 3,
  stepsToReproduce: "1. Call API\n2. Observe 500",
  expectedBehaviour: "HTTP 200",
  actualBehaviour: "HTTP 500 intermittently",
  evidence: analysis.validatedEvidence.map((item) => ({
    ...item,
    source: "extracted_evidence" as const,
  })),
  troubleshootingPerformed: "Reproduced in production.",
  reproducibility: "confirmed",
  issueCategory: "bug",
  missingEvidence: [],
  suspectedRootCause: "Upstream failure",
  escalationScore: 98,
  escalationRecommendation: "escalate",
  decisionRationale: "Enough evidence to escalate to engineering.",
  createdAt: "2026-09-10T19:10:00.000Z",
  source: "engineering_handoff",
};

const awaitingRecord: CaseRecord = {
  id: handoff.caseId,
  customer: "[DEMO] Acme Corp",
  product: "API v3",
  severity: "high",
  issueTitle: handoff.title,
  issueDescription: handoff.summary,
  environment: "production",
  stepsToReproduce: handoff.stepsToReproduce,
  expectedBehaviour: handoff.expectedBehaviour,
  actualBehaviour: handoff.actualBehaviour,
  troubleshootingPerformed: handoff.troubleshootingPerformed,
  logsErrors: "HTTP status: 500",
  requestIds: "req-1",
  incidentTimestamp: "2026-09-08T09:14:32.000Z",
  issueFirstObserved: null,
  affectedCustomerCount: 3,
  status: "awaiting_decision",
  createdAt: "2026-09-10T19:09:00.000Z",
  updatedAt: "2026-09-10T19:09:00.000Z",
  analysis,
  escalationResult: escalation,
  events: [],
};

const approvedDecision: HumanDecision = {
  id: "dec-1",
  caseId: handoff.caseId,
  decision: "approved",
  rationale: "Enough evidence to escalate to engineering.",
  decidedBy: "support_engineer",
  decidedAt: "2026-09-10T19:10:00.000Z",
  escalationScoreAtDecision: 98,
  recommendationAtDecision: "escalate",
  source: "human_decision",
};

const approvedRecord: CaseRecord = {
  ...awaitingRecord,
  status: "escalated",
  decision: approvedDecision,
  handoff,
};

const rejectedRecord: CaseRecord = {
  ...awaitingRecord,
  status: "investigation_continues",
  decision: {
    ...approvedDecision,
    decision: "rejected",
    rationale: "Need more evidence first.",
  },
};

describe("downstream demo adapters", () => {
  it("gates availability on human approval + handoff", () => {
    expect(canCreateDownstreamDemo(awaitingRecord)).toBe(false);
    expect(canCreateDownstreamDemo(rejectedRecord)).toBe(false);
    expect(canCreateDownstreamDemo(approvedRecord)).toBe(true);
  });

  it("generates deterministic Jira and Rootly demo IDs", () => {
    const jiraA = buildDemoJiraKey(handoff.caseId, handoff.id);
    const jiraB = buildDemoJiraKey(handoff.caseId, handoff.id);
    const rootlyA = buildDemoRootlyId(handoff.caseId, handoff.id);
    const rootlyB = buildDemoRootlyId(handoff.caseId, handoff.id);
    expect(jiraA).toBe(jiraB);
    expect(rootlyA).toBe(rootlyB);
    expect(jiraA).toMatch(/^ENG-DEMO-\d{4}$/);
    expect(rootlyA).toMatch(/^INC-DEMO-\d{3}$/);
  });

  it("builds Jira preview from existing handoff data without inventing facts", () => {
    const result = createDemoJiraEscalation(handoff);
    expect(result.demo).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.key).toBe(buildDemoJiraKey(handoff.caseId, handoff.id));
    expect(result.priority).toBe(severityToJiraPriority("high"));
    expect(result.type).toBe("Bug");
    expect(result.preview.summary).toBe("Intermittent 500 errors");
    expect(result.preview.environment).toBe("production");
    expect(result.preview.affectedCustomers).toBe("3");
    expect(result.preview.decisionRationale).toBe(handoff.decisionRationale);
    expect(result.preview.evidence[0]).toContain("HTTP status: 500");
    expect(result.preview.description).toContain(handoff.summary);
    expect(result.preview.description).not.toContain("[DEMO]");
    expect(result.preview.summary).not.toContain("[DEMO]");
  });

  it("uses safe placeholders for missing handoff fields", () => {
    const sparse: EscalationHandoff = {
      ...handoff,
      expectedBehaviour: "",
      affectedCustomerCount: null,
      evidence: [],
      customerImpact: "",
    };
    const jira = createDemoJiraEscalation(sparse);
    expect(jira.preview.affectedCustomers).toBe("Not provided");
    expect(jira.preview.evidence).toEqual(["Not provided"]);
    expect(jira.preview.description).toContain("Not provided");

    const rootly = createDemoRootlyIncident(sparse);
    expect(rootly.preview.impact).toBe("Not provided");
    expect(rootly.preview.affectedCustomers).toBe("Not provided");
  });

  it("builds Rootly preview and optional local Jira cross-reference", () => {
    const jira = createDemoJiraEscalation(handoff);
    const rootly = createDemoRootlyIncident(handoff, jira.key);
    expect(rootly.id).toBe(buildDemoRootlyId(handoff.caseId, handoff.id));
    expect(rootly.status).toBe("Active");
    expect(rootly.severity).toBe("high");
    expect(rootly.preview.title).toBe("Intermittent 500 errors");
    expect(rootly.preview.title).not.toContain("[DEMO]");
    expect(rootly.preview.linkedEngineeringEscalation).toBe(jira.key);
  });

  it("does not perform network requests when creating demo results", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    createDemoJiraEscalation(handoff);
    createDemoRootlyIncident(handoff);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not mutate escalation score or recommendation on the handoff", () => {
    const scoreBefore = handoff.escalationScore;
    const recBefore = handoff.escalationRecommendation;
    createDemoJiraEscalation(handoff);
    createDemoRootlyIncident(handoff);
    expect(handoff.escalationScore).toBe(scoreBefore);
    expect(handoff.escalationRecommendation).toBe(recBefore);
    expect(escalation.escalationScore).toBe(98);
    expect(escalation.recommendation).toBe("escalate");
  });
});

describe("handoff UI downstream gating", () => {
  it("does not expose Jira/Rootly create actions before approval", () => {
    const html = renderToStaticMarkup(<HandoffTab record={awaitingRecord} />);
    expect(html).toContain("Awaiting human approval");
    expect(html).toContain("Available after approval");
    expect(html).not.toContain("Create Jira escalation");
    expect(html).not.toContain("Create Rootly incident");
  });

  it("does not expose downstream actions when investigation continues", () => {
    const html = renderToStaticMarkup(<HandoffTab record={rejectedRecord} />);
    expect(html).toContain("Continue investigation");
    expect(html).toContain(caseDetailTwoColumnGridClassName);
    expect(html).not.toContain("Escalation rejected");
    expect(html).not.toContain("Create Jira escalation");
    expect(html).not.toContain("Create Rootly incident");
  });

  it("exposes Jira and Rootly actions after approval", () => {
    const html = renderToStaticMarkup(<HandoffTab record={approvedRecord} />);
    expect(html).toContain("✓ Approved");
    expect(html).not.toContain("Escalation approved");
    expect(html).toContain("Ready for Engineering");
    expect(html).toContain("View full engineering handoff");
    expect(html).toContain("Create Jira escalation");
    expect(html).toContain("Create Rootly incident");
    expect(html).toContain("Demo integration");
    expect(html).toContain("Simulated only. No external systems are contacted.");
    expect(html).not.toContain("Choose the action that fits the situation");
    expect(html).not.toContain("Open in Jira");
    expect(html).not.toContain("Open in Rootly");
  });
});
