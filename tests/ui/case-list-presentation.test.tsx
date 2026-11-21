import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseListTable } from "@/components/cases/CaseListTable";
import { formatDateTime, formatDateTimeParts } from "@/lib/format";
import {
  formatCaseKey,
  formatRecommendationLabel,
} from "@/lib/ui/case-display";
import type { SupportCaseSummary } from "@/types";

const cases: SupportCaseSummary[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    customer: "[DEMO] Apex Digital",
    product: "MS Teams Integration",
    severity: "high",
    issueTitle:
      "[DEMO] MS Teams Auto-Answer fails to respond in public channels",
    environment: "production",
    status: "investigation_continues",
    createdAt: "2026-09-12T09:15:00.000Z",
    updatedAt: "2026-09-12T14:40:00.000Z",
    escalationRecommendation: "continue_investigation",
    escalationScore: 58,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    customer: "[DEMO] Meridian Systems",
    product: "SSO",
    severity: "medium",
    issueTitle:
      "[DEMO] SSO authentication fails after identity provider certificate rotation",
    environment: "production",
    status: "awaiting_decision",
    createdAt: "2026-09-11T10:20:00.000Z",
    updatedAt: "2026-09-11T11:00:00.000Z",
    escalationRecommendation: "insufficient_evidence",
    escalationScore: 20,
  },
  {
    id: "11111111-1111-4111-8111-111111111111",
    customer: "[DEMO] Northstar Financial",
    product: "API v3",
    severity: "high",
    issueTitle:
      "[DEMO] Intermittent 500 errors when retrieving articles through API v3",
    environment: "production",
    status: "escalated",
    createdAt: "2026-09-08T11:30:00.000Z",
    updatedAt: "2026-09-08T16:15:00.000Z",
    escalationRecommendation: "escalate",
    escalationScore: 98,
  },
];

describe("dashboard case list presentation", () => {
  it("formats recommendation labels for Support Ops readers", () => {
    expect(formatRecommendationLabel("escalate")).toBe("Escalate");
    expect(formatRecommendationLabel("continue_investigation")).toBe(
      "Continue investigation",
    );
    expect(formatRecommendationLabel("insufficient_evidence")).toBe(
      "Insufficient evidence",
    );
  });

  it("formats Reported timestamps with reusable date/time parts", () => {
    const formatted = formatDateTime("2026-09-10T19:09:00.000Z");
    expect(formatted).toMatch(/^\d{1,2} Sep 2026, \d{2}:\d{2}$/);
    const parts = formatDateTimeParts("2026-09-10T19:09:00.000Z");
    expect(parts).toEqual({
      date: expect.stringMatching(/^\d{1,2} Sep 2026$/),
      time: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });

  it("renders Case ID and Issue as separate columns without row metadata", () => {
    const html = renderToStaticMarkup(<CaseListTable cases={cases} />);

    const caseId = html.indexOf(">Case ID<");
    const issue = html.indexOf(">Issue<");
    const customer = html.indexOf(">Customer<");
    const severity = html.indexOf(">Severity<");
    const status = html.indexOf(">Status<");
    const recommendation = html.indexOf(">Recommendation<");
    const updated = html.indexOf(">Updated<");

    expect(caseId).toBeGreaterThan(-1);
    expect(issue).toBeGreaterThan(caseId);
    expect(customer).toBeGreaterThan(issue);
    expect(severity).toBeGreaterThan(customer);
    expect(status).toBeGreaterThan(severity);
    expect(recommendation).toBeGreaterThan(status);
    expect(updated).toBeGreaterThan(recommendation);

    expect(html).not.toContain(">Reported<");
    expect(html).not.toContain(">Product<");
    expect(html).not.toContain(">Environment<");
    expect(html).not.toContain("Reported ");
    expect(html).not.toContain("min-w-[78rem]");
    expect(html).toContain("table-fixed");
    expect(html).toContain("xl:block");
    expect(html).toContain("xl:hidden");
    expect(html).toContain("width:32%");
    expect(html).toContain("width:9%");
    expect(html).toContain("whitespace-nowrap");

    expect(html).toContain("Northstar Financial");
    expect(html).toContain("Apex Digital");
    expect(html).toContain("Meridian Systems");
    expect(html).not.toContain("[DEMO]");
    expect(html).toContain(formatCaseKey(cases[0].id));
    expect(html).not.toContain("MS Teams Integration ·");
    expect(html).not.toContain("SSO ·");
    expect(html).toContain(
      "Intermittent 500 errors when retrieving articles through API v3",
    );
    expect(html).toContain(
      "SSO authentication fails after identity provider certificate rotation",
    );
    expect(html).toContain(
      "MS Teams Auto-Answer fails to respond in public channels",
    );

    expect(html).toContain("Escalate");
    expect(html).not.toContain("98/100");
    expect(html).not.toContain("58/100");
    expect(html).not.toContain("20/100");
    expect(html).toContain("Continue investigation");
    expect(html).toContain("Insufficient evidence");
    expect(html).toContain(`/cases/${cases[2].id}`);

    expect(html).toContain(">8 Sep 2026<");
    expect(html).toContain(">11 Sep 2026<");
    expect(html).toContain(">12 Sep 2026<");
  });
});
