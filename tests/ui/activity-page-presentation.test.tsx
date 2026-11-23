import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import type { ActivityFeedItem } from "@/lib/ui/activity-feed";

describe("Activity feed presentation", () => {
  it("uses a chronological divider layout with case navigation", () => {
    const items: ActivityFeedItem[] = [
      {
        caseId: "11111111-1111-4111-8111-111111111111",
        caseTitle: "SAML SSO failing for some users",
        customer: "Orchid Health",
        event: {
          id: "e1",
          caseId: "11111111-1111-4111-8111-111111111111",
          eventType: "human_decision_recorded",
          createdAt: new Date().toISOString(),
          metadata: { decision: "Approved" },
        },
      },
      {
        caseId: "22222222-2222-4222-8222-222222222222",
        caseTitle: "Intermittent HTTP 504 Gateway Timeout Errors",
        customer: "Vertex Media",
        event: {
          id: "e2",
          caseId: "22222222-2222-4222-8222-222222222222",
          eventType: "escalation_evaluated",
          createdAt: "2026-09-10T12:00:00.000Z",
          metadata: { score: 82, recommendation: "escalate" },
        },
      },
    ];

    const html = renderToStaticMarkup(<ActivityFeed items={items} />);

    expect(html).toContain("Today");
    expect(html).toContain("Earlier");
    expect(html).toContain("Escalation approval recorded");
    expect(html).toContain("Orchid Health");
    expect(html).toContain("View case →");
    expect(html).toContain(`/cases/${items[0].caseId}`);
    expect(html).toContain("divide-y");
    expect(html).not.toContain("fabricated");
  });
});
