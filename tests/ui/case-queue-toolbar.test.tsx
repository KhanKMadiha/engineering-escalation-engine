import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseQueueClient } from "@/components/cases/CaseQueueClient";
import type { SupportCaseSummary } from "@/types";

const cases: SupportCaseSummary[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    customer: "[DEMO] Apex Digital",
    product: "MS Teams Integration",
    severity: "high",
    issueTitle: "[DEMO] MS Teams Auto-Answer fails",
    environment: "production",
    status: "investigation_continues",
    createdAt: "2026-09-12T09:15:00.000Z",
    updatedAt: "2026-09-12T14:40:00.000Z",
    escalationRecommendation: "continue_investigation",
    escalationScore: 58,
  },
];

describe("case queue compact filter toolbar", () => {
  it("renders desktop primary filters and collapsed mobile Filters control", () => {
    const html = renderToStaticMarkup(<CaseQueueClient cases={cases} />);

    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Filter cases"');
    expect(html).toContain("Search by case ID, customer, or issue...");
    expect(html).toContain("filter-status");
    expect(html).toContain("filter-severity");
    expect(html).toContain("filter-environment");
    expect(html).toContain("filter-reported");
    expect(html).toContain("All time");
    expect(html).toContain("Last 30 days");
    expect(html).toContain("Last 60 days");
    expect(html).toContain("Last 90 days");
    expect(html).toContain("More filters");
    expect(html).toContain("Filters");
    expect(html).toContain("lg:flex-nowrap");
    expect(html).toContain("w-[10.5rem]");
    expect(html).toContain("w-[8.5rem]");
    expect(html).toContain("w-[9.75rem]");
    expect(html).toContain("w-[8.75rem]");
    expect(html).toContain("appearance-none");
    expect(html).toContain("Showing");
    expect(html).not.toContain("Clear filters");
    // Recommendation stays in More filters / mobile panel (closed by default)
    expect(html).not.toContain("filter-recommendation");
    expect(html).not.toContain("filter-recommendation-mobile");
  });
});
