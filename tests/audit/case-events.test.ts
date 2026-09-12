import { describe, expect, it } from "vitest";
import { createCaseEvent } from "@/lib/audit/case-events";

describe("createCaseEvent", () => {
  it("builds an event with generated id and timestamp", () => {
    const event = createCaseEvent({
      caseId: "case-1",
      eventType: "case_created",
      metadata: { status: "draft" },
    });

    expect(event.caseId).toBe("case-1");
    expect(event.eventType).toBe("case_created");
    expect(event.metadata).toEqual({ status: "draft" });
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false);
  });

  it("respects explicit id and createdAt", () => {
    const event = createCaseEvent({
      caseId: "case-2",
      eventType: "status_changed",
      id: "event-fixed",
      createdAt: "2026-01-15T12:00:00.000Z",
    });

    expect(event.id).toBe("event-fixed");
    expect(event.createdAt).toBe("2026-01-15T12:00:00.000Z");
  });
});
