import { describe, expect, it } from "vitest";
import { buildActivityFeed } from "@/lib/ui/activity-feed";
import type { CaseRecord } from "@/types";

function minimalRecord(
  overrides: Partial<CaseRecord> & Pick<CaseRecord, "id" | "events">,
): CaseRecord {
  return {
    customer: "[DEMO] Acme",
    product: "API",
    severity: "high",
    issueTitle: "[DEMO] Example issue",
    issueDescription: "desc",
    environment: "production",
    stepsToReproduce: "",
    expectedBehaviour: "ok",
    actualBehaviour: "fail",
    troubleshootingPerformed: "steps",
    logsErrors: "",
    requestIds: "",
    incidentTimestamp: null,
    issueFirstObserved: null,
    affectedCustomerCount: 1,
    status: "awaiting_decision",
    createdAt: "2026-09-10T10:00:00.000Z",
    updatedAt: "2026-09-10T11:00:00.000Z",
    ...overrides,
  };
}

describe("buildActivityFeed", () => {
  it("aggregates and sorts existing events newest first without inventing any", () => {
    const records = [
      minimalRecord({
        id: "11111111-1111-4111-8111-111111111111",
        events: [
          {
            id: "e1",
            caseId: "11111111-1111-4111-8111-111111111111",
            eventType: "case_created",
            createdAt: "2026-09-10T10:00:00.000Z",
          },
          {
            id: "e2",
            caseId: "11111111-1111-4111-8111-111111111111",
            eventType: "analysis_completed",
            createdAt: "2026-09-10T12:00:00.000Z",
          },
        ],
      }),
      minimalRecord({
        id: "22222222-2222-4222-8222-222222222222",
        issueTitle: "[DEMO] Later case",
        events: [
          {
            id: "e3",
            caseId: "22222222-2222-4222-8222-222222222222",
            eventType: "human_decision_recorded",
            createdAt: "2026-09-10T13:00:00.000Z",
          },
        ],
      }),
    ];

    const feed = buildActivityFeed(records, 10);
    expect(feed).toHaveLength(3);
    expect(feed[0].event.id).toBe("e3");
    expect(feed[1].event.id).toBe("e2");
    expect(feed[2].event.id).toBe("e1");
    expect(feed[0].caseTitle).toBe("Later case");
    expect(feed.every((item) => item.event.id.startsWith("e"))).toBe(true);
  });
});
