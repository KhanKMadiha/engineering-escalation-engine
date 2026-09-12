import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { caseDetailTwoColumnGridClassName } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseIssueHeader } from "@/components/cases/CaseIssueHeader";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import { CaseWorkspaceTabs } from "@/components/cases/CaseWorkspaceTabs";
import { HumanDecisionResultPanel } from "@/components/cases/HumanDecisionResultPanel";
import { AssessmentTab } from "@/components/cases/tabs/AssessmentTab";
import { HandoffTab } from "@/components/cases/tabs/HandoffTab";
import { InvestigationTab } from "@/components/cases/tabs/InvestigationTab";
import { OverviewTab } from "@/components/cases/tabs/OverviewTab";
import {
  ESCALATION_THRESHOLDS,
  ESCALATION_WEIGHTS,
} from "@/lib/escalation/escalation-rules";
import {
  formatCaseKey,
  formatSignalLabel,
  qualifyingFactors,
  shortenText,
  troubleshootingSummaryLines,
} from "@/lib/ui/case-display";
import {
  buildCurrentCaseCalculation,
  buildScoringModelGroups,
  escalateThreshold,
} from "@/lib/ui/scoring-model-display";
import type {
  CaseEvent,
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
    reasoning: "Detailed AI reasoning that should be disclosed.",
    evidenceIdentified: [],
    missingEvidence: ["HAR file"],
    recommendedNextSteps: ["Collect logs"],
    suspectedRootCause: "Intermittent upstream failure",
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
  analysisWarnings: ["One excerpt was normalized"],
  model: "demo-model",
  promptVersion: "1.2",
  createdAt: "2026-09-10T19:09:00.000Z",
};

const escalation: EscalationEngineResult = {
  escalationScore: 98,
  recommendation: "escalate",
  contributingFactors: [
    {
      signal: "production_environment",
      weight: 25,
      direction: "increases",
      reason: "The reported issue is affecting a production environment.",
    },
    {
      signal: "reported_severity",
      weight: 15,
      direction: "increases",
      reason: "Customer-reported severity is high.",
    },
    {
      signal: "ai_assessed_severity",
      weight: 3,
      direction: "increases",
      reason:
        "AI-assessed severity is high (secondary signal; does not override customer-reported severity).",
    },
    {
      signal: "suspected_product_defect",
      weight: 20,
      direction: "increases",
      reason: "Validated analysis indicates a suspected product defect.",
    },
    {
      signal: "confirmed_reproducibility",
      weight: 15,
      direction: "increases",
      reason: "Issue reproducibility is confirmed.",
    },
    {
      signal: "evidence_completeness",
      weight: 10,
      direction: "increases",
      reason: "Validated evidence completeness is 0.8 (≥ 0.7).",
    },
    {
      signal: "troubleshooting_completed",
      weight: 10,
      direction: "increases",
      reason: "Support documented troubleshooting steps.",
    },
  ],
  recommendationReasons: ["Strong production evidence"],
  source: "deterministic_engine",
};

const events: CaseEvent[] = [
  {
    id: "e1",
    caseId: "11111111-1111-4111-8111-111111111111",
    eventType: "case_created",
    createdAt: "2026-09-10T19:09:00.000Z",
  },
  {
    id: "e2",
    caseId: "11111111-1111-4111-8111-111111111111",
    eventType: "escalation_evaluated",
    createdAt: "2026-09-10T19:09:30.000Z",
    metadata: { score: 98, recommendation: "escalate" },
  },
];

const record: CaseRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  customer: "[DEMO] Acme Corp",
  product: "API v3",
  severity: "high",
  issueTitle: "[DEMO] Intermittent 500 errors",
  issueDescription: "Customers cannot retrieve articles.",
  environment: "production",
  stepsToReproduce: "1. Call API\n2. Observe 500",
  expectedBehaviour: "HTTP 200",
  actualBehaviour: "HTTP 500 intermittently",
  troubleshootingPerformed:
    "Reproduced the issue in production.\nConfirmed authentication succeeds.\nTested multiple article IDs.",
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
  events,
};

const handoff: EscalationHandoff = {
  id: "ho-1",
  caseId: record.id,
  title: record.issueTitle,
  summary: record.issueDescription,
  customerImpact: "3 customers affected",
  environment: "production",
  reportedSeverity: "high",
  affectedCustomerCount: 3,
  stepsToReproduce: record.stepsToReproduce,
  expectedBehaviour: record.expectedBehaviour,
  actualBehaviour: record.actualBehaviour,
  evidence: analysis.validatedEvidence.map((item) => ({
    ...item,
    source: "extracted_evidence" as const,
  })),
  troubleshootingPerformed: record.troubleshootingPerformed,
  reproducibility: "confirmed",
  issueCategory: "bug",
  missingEvidence: ["HAR file"],
  suspectedRootCause: "Intermittent upstream failure",
  escalationScore: 98,
  escalationRecommendation: "escalate",
  decisionRationale: "Enough evidence to escalate to engineering.",
  createdAt: "2026-09-10T19:10:00.000Z",
  source: "engineering_handoff",
};

describe("presentation helpers", () => {
  it("formats display helpers without inventing domain data", () => {
    expect(formatCaseKey(record.id)).toBe("11111111");
    expect(formatSignalLabel("production_environment")).toBe(
      "Production impact",
    );
    expect(
      troubleshootingSummaryLines(record.troubleshootingPerformed),
    ).toHaveLength(3);
    expect(shortenText("short")).toBe("short");
    expect(qualifyingFactors(escalation.contributingFactors).length).toBeGreaterThan(
      0,
    );
  });

  it("builds scoring model groups from real rule constants", () => {
    const groups = buildScoringModelGroups({
      reportedSeverity: "high",
      aiAssessedSeverity: "high",
    });
    const severity = groups.find((g) => g.title === "Customer-reported severity");
    expect(severity?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Critical",
          weight: ESCALATION_WEIGHTS.reportedSeverityCritical,
        }),
        expect.objectContaining({
          label: "High",
          weight: ESCALATION_WEIGHTS.reportedSeverityHigh,
          isCurrent: true,
        }),
        expect.objectContaining({
          label: "Medium",
          weight: ESCALATION_WEIGHTS.reportedSeverityMedium,
        }),
        expect.objectContaining({
          label: "Low / otherwise",
          weight: ESCALATION_WEIGHTS.reportedSeverityLow,
        }),
      ]),
    );
    expect(escalateThreshold()).toBe(ESCALATION_THRESHOLDS.escalateMin);
  });

  it("reconciles current-case calculation to engine score", () => {
    const calc = buildCurrentCaseCalculation(escalation);
    const sum = calc.lines.reduce((s, line) => s + line.weight, 0);
    expect(sum).toBe(98);
    expect(calc.displayedScore).toBe(98);
    expect(calc.wasClamped).toBe(false);
  });
});

describe("final case workspace presentation", () => {
  it("renders four workflow tabs with arrow separators", () => {
    const html = renderToStaticMarkup(
      <CaseWorkspaceTabs renderPanel={(tab) => <div>panel-{tab}</div>} />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Overview");
    expect(html).toContain("Investigation");
    expect(html).toContain("Escalation Assessment");
    expect(html).toContain("Handoff");
    expect(html).toContain("→");
    expect(html).not.toContain(">Activity<");
    expect(html).toContain("panel-overview");
  });

  it("places compact Timeline on Overview with disclosure", () => {
    const html = renderToStaticMarkup(
      <OverviewTab record={record} goToTab={() => undefined} />,
    );
    expect(html).toContain("Timeline");
    expect(html).toContain("Events");
    expect(html).toContain("History");
    expect(html).toContain("View timeline");
    expect(html).not.toContain("2 events");
    expect(html).not.toContain("Case created");
    expect(html).not.toContain("Collapse timeline");
    expect(html).toContain("View investigation");
    expect(html).toContain("View escalation assessment");
    expect(html).toContain("Escalation recommendation");
    expect(html).toContain("ESCALATE");
    expect(html).toContain("Human approval required");
    expect(html).toContain("authorised reviewer");
    expect(html).toContain("Expected behaviour");
    expect(html).toContain("Actual behaviour");
    expect(html).not.toContain("How is this calculated?");
    expect(html).not.toContain("HTTP status: 500");
    expect(html).not.toContain("req-1");
    expect(html).not.toContain("Detailed AI reasoning");
    // Case details is primary sidebar context; Timeline sits beneath it
    expect(html.indexOf("Case details")).toBeLessThan(html.indexOf("Timeline"));
    expect(html).toContain(caseDetailTwoColumnGridClassName);
  });

  it("shows approved current-action copy directing reviewers to Handoff", () => {
    const approved: CaseRecord = {
      ...record,
      status: "escalated",
      decision: {
        id: "dec-1",
        caseId: record.id,
        decision: "approved",
        rationale: "Enough evidence to escalate to engineering.",
        decidedBy: "support_engineer",
        decidedAt: "2026-09-10T19:10:00.000Z",
        escalationScoreAtDecision: 98,
        recommendationAtDecision: "escalate",
        source: "human_decision",
      },
      handoff,
    };
    const html = renderToStaticMarkup(
      <OverviewTab record={approved} goToTab={() => undefined} />,
    );
    expect(html).toContain("Current action");
    expect(html).toContain("Approved for escalation");
    expect(html).toContain(
      "Engineering handoff is ready. Review the handoff and create the Jira escalation or Rootly incident from the Handoff tab.",
    );
    expect(html).toContain("Open Handoff");
    expect(html).not.toContain("package");
    expect(html).not.toContain("Approve escalation");
  });

  it("keeps case details compact in the overview sidebar", () => {
    const html = renderToStaticMarkup(<CaseDetailsCard record={record} />);
    expect(html).toContain("Case details");
    expect(html).toContain("Case ID");
    expect(html).toContain("11111111");
    expect(html).toContain("Affected customer count");
    expect(html).toContain("Customer");
    expect(html).toContain("Product");
    expect(html).toContain("justify-between");
    expect(html).toContain("text-right");
    expect(html).not.toContain("Created");
    expect(html).not.toContain("Reported");
    expect(html).not.toContain("Updated");
  });

  it("groups investigation with technical evidence in a secondary sidebar", () => {
    const html = renderToStaticMarkup(<InvestigationTab record={record} />);
    expect(html).toContain("Investigation");
    expect(html).toContain("Issue description");
    expect(html).toContain("Expected behaviour");
    expect(html).toContain("Actual behaviour");
    expect(html).toContain("Steps to reproduce");
    expect(html).toContain("Troubleshooting performed");
    expect(html).toContain("Technical evidence");
    expect(html).toContain("Logs / errors");
    expect(html).toContain("Call API");
    expect(html).toContain("HTTP status: 500");
    expect(html).toContain("req-1");
    expect(html).toContain("Affected customer count");
    expect(html).toContain("Issue first observed");
    expect(html).toContain("Request ID");
    expect(html).toContain("Reproducibility");
    expect(html).toContain(caseDetailTwoColumnGridClassName);
    expect(html).not.toContain(">Customer<");
    expect(html).not.toContain("Case ID");
    // Reproducibility sits after intro copy and before Issue description
    expect(html.indexOf("Reproducibility")).toBeLessThan(
      html.indexOf("Issue description"),
    );
    // Narrative fields precede technical evidence heading
    expect(html.indexOf("Issue description")).toBeLessThan(
      html.indexOf("Technical evidence"),
    );
    expect(html.indexOf("Expected behaviour")).toBeLessThan(
      html.indexOf("Steps to reproduce"),
    );
    expect(html.indexOf("Steps to reproduce")).toBeLessThan(
      html.indexOf("Troubleshooting performed"),
    );
  });

  it("labels MS Teams requestIds as Correlation reference", () => {
    const teamsRecord: CaseRecord = {
      ...record,
      product: "MS Teams Integration",
      requestIds: "Partial correlation note: teams-public-ch-pending",
      issueFirstObserved: "First noticed on 11 Sep 2026 in public channels",
    };
    const html = renderToStaticMarkup(
      <InvestigationTab record={teamsRecord} />,
    );
    expect(html).toContain("Correlation reference");
    expect(html).toContain("teams-public-ch-pending");
    expect(html).not.toContain("Partial correlation note:");
    expect(html).toContain("11 Sep 2026");
    expect(html).not.toContain("First noticed on");
    expect(html).not.toContain("in public channels");
    expect(html).not.toContain("Request ID");
  });

  it("exposes an interactive AI provenance badge on Reproducibility", () => {
    const html = renderToStaticMarkup(<InvestigationTab record={record} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("AI-assessed");
    expect(html).toContain(
      "This value was inferred from the case evidence. AI analysis is advisory and does not determine the escalation score or final decision.",
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Activate for explanation");
    // Compact badge label remains "AI"; case-specific reasoning stays elsewhere
    expect(html).toMatch(/>AI</);
    expect(html).not.toContain("Detailed AI reasoning that should be disclosed.");
  });

  it("explains escalation assessment with authority in the sidebar", () => {
    const html = renderToStaticMarkup(
      <AssessmentTab record={record} />,
    );
    expect(html).toContain("Escalation recommendation");
    expect(html).toContain("ESCALATE");
    expect(html).toContain("Signals considered");
    expect(html).not.toContain("Why this case qualifies");
    expect(html).toContain("Technical assessment");
    expect(html).toContain("98 / 100");
    expect(html).toContain(`${ESCALATION_THRESHOLDS.escalateMin} / 100`);
    expect(html).toContain("How is this calculated?");
    expect(html).toContain("Customer-reported severity");
    expect(html).toContain(`+${ESCALATION_WEIGHTS.reportedSeverityCritical}`);
    expect(html).toContain(`+${ESCALATION_WEIGHTS.reportedSeverityHigh}`);
    expect(html).toContain("← This case");
    expect(html).toContain("Current case");
    expect(html).toContain("Decision authority");
    expect(html).toContain(caseDetailTwoColumnGridClassName);
    expect(html).toContain("Rules-based assessment");
    expect(html).toContain("Human reviewer");
    expect(html).toContain("AI cannot approve an escalation.");
    expect(html).not.toContain("Return to Overview to review decision");
    expect(html).toContain("View AI reasoning");
    expect(html).toContain("View validated evidence");
    expect(html).not.toContain("Deterministic escalation assessment");
    expect(html).not.toContain("Approve escalation");
  });

  it("locks handoff before approval and exposes demo actions after", () => {
    const pending = renderToStaticMarkup(<HandoffTab record={record} />);
    expect(pending).toContain("Awaiting human approval");
    expect(pending).not.toContain("Create Jira escalation");

    const approved: CaseRecord = {
      ...record,
      status: "escalated",
      decision: {
        id: "dec-1",
        caseId: record.id,
        decision: "approved",
        rationale: "Enough evidence to escalate to engineering.",
        decidedBy: "support_engineer",
        decidedAt: "2026-09-10T19:10:00.000Z",
        escalationScoreAtDecision: 98,
        recommendationAtDecision: "escalate",
        source: "human_decision",
      },
      handoff,
    };
    const html = renderToStaticMarkup(<HandoffTab record={approved} />);
    expect(html).toContain("Downstream actions");
    expect(html).toContain("Create Jira escalation");
    expect(html).toContain("Create Rootly incident");
    expect(html).toContain("Demo integration");
    expect(html).toContain("Simulated only. No external systems are contacted.");
    expect(html).not.toContain("Choose the action that fits the situation");
    expect(html).toContain("✓ Approved");
    expect(html).not.toContain("Escalation approved");
    expect(html).toContain("Handoff summary");
    expect(html).toContain("Ready for Engineering");
    expect(html).toContain("Decision");
    expect(html).toContain("Escalate");
    expect(html).toContain("98 / 100");
    expect(html).toContain("Affected customer count");
    expect(html).toContain("Reviewer");
    expect(html).toContain("Authorised reviewer");
    expect(html).not.toContain("Support Engineer");
    expect(html).toContain("Enough evidence to escalate to engineering.");
    expect(html).toContain(caseDetailTwoColumnGridClassName);
    expect(html).toContain("max-w-xl");
    // Sidebar must not duplicate case header metadata
    expect(html).not.toContain(">Customer<");
    expect(html).not.toContain(">Product<");
    expect(html).not.toContain(">Case ID<");
  });

  it("renders compact timeline summary without listing events by default", () => {
    const html = renderToStaticMarkup(<CaseTimeline events={events} />);
    expect(html).toContain("Timeline");
    expect(html).toContain("Events");
    expect(html).toContain("History");
    expect(html).toContain("View timeline");
    expect(html).not.toContain("2 events");
    expect(html).not.toContain("Case created");
    expect(html).not.toContain("Collapse timeline");
    expect(html).not.toContain("View technical audit data");
  });

  it("renders continue-investigation outcome after rejection to investigation_continues", () => {
    const decision: HumanDecision = {
      id: "dec-1",
      caseId: record.id,
      decision: "rejected",
      rationale:
        "Further channel permission and configuration checks are required before engineering escalation.",
      decidedBy: "support_engineer",
      decidedAt: "2026-09-12T14:40:00.000Z",
      escalationScoreAtDecision: 58,
      recommendationAtDecision: "continue_investigation",
      source: "human_decision",
    };
    const html = renderToStaticMarkup(
      <HumanDecisionResultPanel
        decision={decision}
        caseStatus="investigation_continues"
      />,
    );
    expect(html).toContain("Continue investigation");
    expect(html).not.toContain("Escalation rejected");
    expect(html).toContain("Support Engineer");
    expect(html).not.toContain("support_engineer");
    expect(html).toContain("Decided by");
    expect(html).toContain("Decided");
    expect(html).toContain("Rationale");
    expect(html).toContain(
      "Further channel permission and configuration checks are required before engineering escalation.",
    );
  });

  it("keeps issue header compact with Reported and Updated", () => {
    const html = renderToStaticMarkup(<CaseIssueHeader record={record} />);
    expect(html).toContain("Back to cases");
    expect(html).toContain("Demo case");
    expect(html).toContain("Fictional data");
    expect(html).toContain("Intermittent 500 errors");
    expect(html).not.toContain("[DEMO]");
    expect(html).not.toContain(`Case ${formatCaseKey(record.id)}`);
    expect(html).not.toContain(">Case ID<");
    expect(html).toContain("Reported");
    expect(html).toContain("Updated");
    expect(html).not.toContain(">Created");

    const customer = html.indexOf("Customer:");
    const title = html.indexOf("Intermittent 500 errors");
    const severity = html.indexOf(">high<");
    expect(customer).toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(customer);
    expect(severity).toBeGreaterThan(title);
  });

  it("renders customer/product as muted metadata without highlight or badge styling", () => {
    const html = renderToStaticMarkup(<CaseIssueHeader record={record} />);
    expect(html).toContain("Customer:");
    expect(html).toContain("Product:");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("API v3");
    expect(html).toContain("·");
    expect(html).toContain("text-slate-500");
    expect(html).toContain("text-slate-700");
    expect(html).toContain("bg-transparent");
    // Metadata line must not pick up warning/highlight treatments
    expect(html).not.toMatch(
      /Acme Corp[\s\S]{0,120}(?:bg-amber|bg-yellow|<mark)/,
    );
    expect(html).not.toMatch(
      /(?:bg-amber|bg-yellow|<mark)[\s\S]{0,120}Acme Corp/,
    );
  });
});
