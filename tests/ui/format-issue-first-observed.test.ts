import { describe, expect, it } from "vitest";
import { formatDateTime, formatIssueFirstObserved } from "@/lib/format";

describe("formatIssueFirstObserved", () => {
  it("prefers approximate text over a precise timestamp", () => {
    expect(
      formatIssueFirstObserved({
        issueFirstObserved: "This morning",
        incidentTimestamp: "2026-09-08T09:14:32.000Z",
      }),
    ).toBe("This morning");
  });

  it("falls back to formatted precise timestamp when approx is empty", () => {
    expect(
      formatIssueFirstObserved({
        issueFirstObserved: null,
        incidentTimestamp: "2026-09-08T09:14:32.000Z",
      }),
    ).toBe(formatDateTime("2026-09-08T09:14:32.000Z"));
  });

  it("returns em dash when both are unknown", () => {
    expect(
      formatIssueFirstObserved({
        issueFirstObserved: "  ",
        incidentTimestamp: null,
      }),
    ).toBe("—");
  });
});
