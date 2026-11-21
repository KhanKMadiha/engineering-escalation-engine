import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { caseDetailTwoColumnGridClassName } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseIssueHeader } from "@/components/cases/CaseIssueHeader";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import { CaseWorkspace } from "@/components/cases/CaseWorkspace";
import { HumanDecisionResultPanel } from "@/components/cases/HumanDecisionResultPanel";
import { AssessmentTab } from "@/components/cases/tabs/AssessmentTab";
import { HandoffTab } from "@/components/cases/tabs/HandoffTab";
import { InvestigationTab } from "@/components/cases/tabs/InvestigationTab";
import { OverviewTab } from "@/components/cases/tabs/OverviewTab";
import { CaseWorkflowStepper } from "@/components/ui/Stepper";
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
  it("renders interactive five-step workflow navigator without tab bar", () => {
    const html = renderToStaticMarkup(<CaseWorkspace record={record} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Case details");
    expect(html).not.toContain(">Intake<");
    expect(html).toContain("Investigation");
    expect(html).toContain("Assessment");
    expect(html).toContain("Human decision");
    expect(html).toContain("Handoff");
    expect(html).not.toContain("Case summary");
    expect(html).not.toContain("Viewing");
    expect(html).not.toContain("does not change workflow state");
    expect(html).not.toContain(">01<");
    expect(html).not.toContain("Escalation Assessment");
    expect(html).not.toContain(">Overview<");
    // Awaiting decision opens at Human decision (current relevant stage)
    expect(html).toContain("Record decision");
    expect(html).toContain("Case workflow section");
  });

  it("keeps original case information reachable via Case details without a Case summary link", () => {
    const html = renderToStaticMarkup(
      <CaseWorkspace record={{ ...record, status: "investigation_continues" }} />,
    );
    expect(html).toContain("Case details");
    expect(html).toContain("Investigation");
    expect(html).not.toContain("Case summary");
    expect(html).toContain("Technical evidence");
  });

  it("distinguishes selected step from case workflow status without helper copy", () => {
    const html = renderToStaticMarkup(
      <CaseWorkflowStepper
        status="awaiting_decision"
        selectedStage="Investigation"
        onSelectStage={() => undefined}
        panelId="panel"
      />,
    );
    expect(html).toContain("Investigation");
    expect(html).toContain("Human decision");
    expect(html).toContain("✓");
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain("Viewing");
    expect(html).not.toContain("does not change workflow state");
    expect(html).not.toContain(">01<");
  });

  it("places a simplified recommendation, next action and recent activity on Overview", () => {
    const html = renderToStaticMarkup(
      <OverviewTab record={record} goToTab={() => undefined} />,
    );
    expect(html).toContain("Recent activity");
    expect(html).toContain("View full timeline");
    expect(html).toContain("Case reported");
    expect(html).toContain("Escalation assessed");
    expect(html).not.toContain("Collapse timeline");
    expect(html).toContain("View full assessment");
    expect(html).toContain("Escalation recommendation");
    expect(html).toContain("Escalate");
    expect(html).toContain("Escalation readiness");
    expect(html).toContain("About escalation readiness score");
    expect(html).not.toContain(
      "Deterministic rules on validated evidence — not an AI confidence",
    );
    // Awaiting decision: decision form is visible — no redundant Next action card
    expect(html).not.toContain("Next action");
    expect(html).not.toContain("Record human decision");
    expect(html).not.toContain("Supporting reasoning");
    expect(html).not.toContain("What we know");
    expect(html).not.toContain("What is missing");
    expect(html).toContain("Record decision");
    expect(html).toContain("Escalation recommendation");
    expect(html).toContain("Expected behaviour");
    expect(html).toContain("Actual behaviour");
    expect(html).toContain("Relevant findings");
    expect(html).not.toContain("How is this calculated?");
    expect(html).not.toContain("HTTP status: 500");
    expect(html).not.toContain("req-1");
    expect(html).not.toContain("Detailed AI reasoning");
    expect(html).not.toContain("Established evidence");
    expect(html).not.toContain("Missing evidence");
    // Recommendation headline stays charcoal; no nested score mini-card
    expect(html).not.toContain("text-warning");
    expect(html).not.toContain("bg-subtle px-4 py-4");
    // Case details is primary sidebar context; activity sits beneath it
    expect(html.indexOf("Case details")).toBeLessThan(
      html.indexOf("Recent activity"),
    );
    expect(html).toContain(caseDetailTwoColumnGridClassName);
  });

  it("renders handoff document Summary without repeating the issue title chrome", () => {
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
    // Section titles are CSS-uppercased in the browser; markup still contains Summary.
    expect(html).toContain("Summary");
    expect(html).not.toContain(">Problem<");
    expect(html).toContain("Handoff document");
    expect(html).toContain("Engineering handoff");
    // Presentation chrome no longer repeats the issue title above the document.
    // Title remains in handoff data for copy/export (CopyHandoffButton), not as visible prose here.
    // Prior automation counted page-header titles + CSS-uppercased "SUMMARY" misses — those were
    // inaccurate assertions against correct behaviour.
    expect(html).not.toContain("Intermittent 500 errors");
    expect(html).toContain("Customers cannot retrieve articles.");
  });

  it("shows next action directing approved reviewers to Handoff", () => {
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
    expect(html).toContain("Next action");
    expect(html).toContain("Open Engineering handoff");
    expect(html).toContain("Open handoff");
    expect(html).not.toContain("Current action");
    expect(html).not.toContain("package");
    expect(html).not.toContain("Approve escalation");
  });

  it("keeps case details compact in the overview sidebar", () => {
    const html = renderToStaticMarkup(<CaseDetailsCard record={record} />);
    expect(html).toContain("Case details");
    expect(html).toContain("Case ID");
    expect(html).toContain("11111111");
    expect(html).toContain(formatCaseKey(record.id));
    expect(html).toContain("Affected customer count");
    expect(html).toContain("Customer");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Product");
    expect(html).toContain("API v3");
    expect(html).toContain("justify-between");
    expect(html).toContain("text-right");
    expect(html).not.toContain("Created");
    expect(html).toContain("Reported");
    expect(html).toContain("Updated");
  });

  it("groups investigation with technical evidence in a secondary sidebar", () => {
    const html = renderToStaticMarkup(
      <InvestigationTab
        record={{
          ...record,
          technicalEvidence: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              caseId: record.id,
              evidenceType: "api_response",
              title: "API response — article GET",
              service: "API v3 /articles/{id}",
              body: "HTTP status: 500\nError: Internal Server Error",
              caption: null,
              capturedAt: "2026-09-08T09:14:32.000Z",
              requestId: "req-1",
              traceId: null,
              externalUrl: null,
              source: "support",
              verificationStatus: "recorded",
              sortOrder: 0,
              createdAt: "2026-09-10T19:09:00.000Z",
              updatedAt: "2026-09-10T19:09:00.000Z",
              attachments: [],
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Investigation");
    expect(html).toContain("Overview");
    expect(html).toContain("Impact &amp; timeline");
    expect(html).toContain("Affected users");
    expect(html).toContain("Not recorded");
    expect(html).not.toContain("Impact scope");
    expect(html).toContain("Affected organisations");
    expect(html).toContain("Issue started");
    expect(html).toContain("Frequency");
    expect(html).toContain("Intermittent");
    expect(html).not.toContain("Last known working");
    expect(html).toContain("Reported");
    expect(html).toContain("Expected vs actual behaviour");
    expect(html).toContain("Expected behaviour");
    expect(html).toContain("Actual behaviour");
    expect(html).toContain("Customer-reported");
    expect(html).toContain("Steps to reproduce");
    expect(html).not.toContain("Reproduction status");
    expect(html).toContain("font-bold");
    expect(html).toContain("Root cause");
    expect(html).toContain("Not yet identified");
    expect(html).toContain("Workaround");
    expect(html).toContain("Not confirmed");
    expect(html).toContain("Troubleshooting performed");
    expect(html).toContain("Next steps");
    expect(html).toContain("Technical evidence");
    expect(html).toContain("Add evidence");
    expect(html).toContain("API response");
    expect(html).toContain("View");
    expect(html).not.toContain("Customer report");
    expect(html).not.toContain("Customer-provided logs");
    expect(html).toContain("HTTP status: 500");
    expect(html).toContain("req-1");
    expect(html).not.toContain("Add screenshot");
    expect(html).toContain(caseDetailTwoColumnGridClassName);
    // Individual section cards (not one mega-card wrapping every section)
    expect(html.match(/rounded-\[var\(--radius-card\)\]/g)?.length ?? 0).toBeGreaterThan(
      5,
    );
    expect(html).not.toContain("Pending evidence");
    expect(html).not.toContain("Datadog");
    expect(html).not.toContain("Postman");
    expect(html).not.toContain("Technical investigation");
    expect(html).not.toContain("Investigation summary");
    expect(html).not.toContain(
      "What happened, what was tested, and what was established.",
    );
    expect(html).not.toContain("Intermittent upstream failure");
    expect(html.indexOf("Overview")).toBeLessThan(
      html.indexOf("Impact &amp; timeline"),
    );
    expect(html.indexOf("Impact &amp; timeline")).toBeLessThan(
      html.indexOf("Expected vs actual behaviour"),
    );
    expect(html.indexOf("Expected vs actual behaviour")).toBeLessThan(
      html.indexOf("Steps to reproduce"),
    );
    expect(html.indexOf("Steps to reproduce")).toBeLessThan(
      html.indexOf("Troubleshooting performed"),
    );
    expect(html.indexOf("Troubleshooting performed")).toBeLessThan(
      html.indexOf("Root cause"),
    );
    expect(html.indexOf("Root cause")).toBeLessThan(html.indexOf("Workaround"));
    expect(html.indexOf("Workaround")).toBeLessThan(html.indexOf("Next steps"));
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
    expect(html).not.toContain("Placeholder · teams-public-ch-pending");
    expect(html).not.toContain("teams-public-ch-pending");
    expect(html).not.toContain("Partial correlation note:");
    expect(html).not.toContain("Correlation reference");
    expect(html).toContain("11 Sep 2026");
    expect(html).toContain("Issue started");
    expect(html).not.toContain("Request ID");
  });

  it("shows a concise investigation overview and actionable reproduction steps", () => {
    const teamsRecord: CaseRecord = {
      ...record,
      product: "MS Teams Integration",
      environment: "production",
      analysis: {
        ...record.analysis!,
        aiResult: {
          ...record.analysis!.aiResult,
          reproducibility: "intermittent",
        },
      },
      issueTitle:
        "[DEMO] MS Teams Auto-Answer fails to respond in public channels",
      issueDescription: [
        "MS Teams Auto-Answer fails to respond in public channels while still working in some private channels.",
        "Investigation is ongoing. Channel permissions or bot membership may still need to be ruled out.",
      ].join("\n"),
      actualBehaviour:
        "Auto-Answer fails to respond in public channels while continuing to respond in some private channels.",
      logsErrors: [
        "Customer-provided note: Auto-Answer timeout in public channel.",
        "No complete webhook or bot-permission log package yet.",
      ].join("\n"),
      requestIds: "Partial correlation note: teams-public-ch-pending",
      stepsToReproduce: [
        "1. Open a public Teams channel where Auto-Answer is expected.",
        "2. Trigger the Auto-Answer flow.",
        "3. Observe that Auto-Answer does not respond.",
        "4. Retry in a private channel where Auto-Answer still responds.",
        "5. Behaviour is intermittent across channel types; controlled reproduction is incomplete.",
      ].join("\n"),
    };
    const html = renderToStaticMarkup(
      <InvestigationTab record={teamsRecord} />,
    );
    expect(html).toContain("Affected product");
    expect(html).toContain("MS Teams Integration");
    expect(html).toContain(
      "MS Teams Auto-Answer fails to respond in public channels while still working in some private channels.",
    );
    expect(html).not.toContain("Investigation is ongoing");
    expect(html).not.toContain("MS Teams Integration · production");
    expect(html).toContain("Open a public Teams channel");
    expect(html).toContain("Unknown");
    expect(html).not.toContain("AI interpretation");
    expect(html).not.toContain("Reproduction status");
    expect(html).not.toContain("Reproduction result");
    expect(html).not.toContain("controlled reproduction is incomplete");
    expect(html).toContain("No technical evidence recorded yet");
    expect(html).not.toContain("Customer report");
    expect(html).not.toMatch(
      /<li[^>]*>Behaviour is intermittent across channel types/i,
    );
  });

  it("shows root cause as not yet identified rather than AI hypothesis", () => {
    const html = renderToStaticMarkup(<InvestigationTab record={record} />);
    expect(html).toContain("Root cause");
    expect(html).toContain("Not yet identified");
    expect(html).not.toContain("Intermittent upstream failure");
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

  it("renders recent activity preview of the latest events by default", () => {
    const html = renderToStaticMarkup(<CaseTimeline events={events} />);
    expect(html).toContain("Recent activity");
    expect(html).toContain("2 events");
    expect(html).toContain("View full timeline");
    expect(html).toContain("Case reported");
    expect(html).toContain("Escalation assessed");
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

  it("keeps issue header to title and badges without duplicated case metadata", () => {
    const html = renderToStaticMarkup(<CaseIssueHeader record={record} />);
    expect(html).toContain("Back to cases");
    expect(html).toContain("Intermittent 500 errors");
    expect(html).not.toContain("[DEMO]");
    expect(html).not.toContain("Demo case");
    expect(html).not.toContain("Fictional data");
    expect(html).not.toContain(formatCaseKey(record.id));
    expect(html).not.toContain(">Case ID<");
    expect(html).not.toContain("Acme Corp");
    expect(html).not.toContain("API v3");
    expect(html).not.toContain("Reported");
    expect(html).not.toContain("Updated");

    const title = html.indexOf("Intermittent 500 errors");
    const severity = html.indexOf(">high<");
    expect(title).toBeGreaterThan(-1);
    expect(severity).toBeGreaterThan(title);
  });
});
