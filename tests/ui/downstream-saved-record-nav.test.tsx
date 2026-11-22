import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DownstreamDemoActions } from "@/components/cases/DownstreamDemoActions";
import type { DemoDownstreamRecord, EscalationHandoff } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const handoff: EscalationHandoff = {
  id: "ho-1",
  caseId: "case-1",
  title: "Issue",
  summary: "Summary",
  customerImpact: "1 customer",
  environment: "production",
  reportedSeverity: "high",
  affectedCustomerCount: 1,
  stepsToReproduce: "1. Reproduce",
  expectedBehaviour: "Success",
  actualBehaviour: "Failure",
  evidence: [],
  troubleshootingPerformed: "Checked logs",
  reproducibility: "confirmed",
  issueCategory: "bug",
  missingEvidence: [],
  suspectedRootCause: "Unknown",
  escalationScore: 90,
  escalationRecommendation: "escalate",
  decisionRationale: "Engineering involvement required.",
  createdAt: "2026-11-22T20:00:00.000Z",
  source: "engineering_handoff",
};

const jiraRecord: DemoDownstreamRecord = {
  id: "ds-jira",
  demoWorkspaceId: "ws-1",
  caseId: "case-1",
  destination: "jira",
  externalReference: "ENG-DEMO-7724",
  payload: {},
  handoffId: "ho-1",
  createdAt: "2026-11-22T20:22:00.000Z",
};

describe("DownstreamDemoActions saved-record navigation", () => {
  it("labels View Jira issue when a saved record exists and lists the reference", () => {
    const html = renderToStaticMarkup(
      <DownstreamDemoActions
        caseId="case-1"
        handoff={handoff}
        customer="[DEMO] Orchid Health"
        existingRecords={[jiraRecord]}
      />,
    );

    expect(html).toContain("View Jira issue");
    expect(html).toContain("ENG-DEMO-7724");
    expect(html).toContain("Saved demo records for this case");
    // Preview create CTA should not appear when the record already exists.
    expect(html).not.toContain(">Create Jira issue<");
  });

  it("shows Create Jira issue when no saved record exists", () => {
    const html = renderToStaticMarkup(
      <DownstreamDemoActions
        caseId="case-1"
        handoff={handoff}
        customer="[DEMO] Orchid Health"
        existingRecords={[]}
      />,
    );

    expect(html).toContain("Create Jira issue");
    expect(html).toContain("Create Rootly incident");
    expect(html).not.toContain("View Jira issue");
  });
});
