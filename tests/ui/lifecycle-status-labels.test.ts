import { describe, expect, it } from "vitest";
import { formatLifecycleStatusLabel } from "@/lib/ui/case-lifecycle-presentation";

describe("formatLifecycleStatusLabel", () => {
  it("presents ordinary escalate wait as Awaiting approval", () => {
    expect(
      formatLifecycleStatusLabel({
        status: "awaiting_decision",
        escalationRecommendation: "escalate",
      }),
    ).toBe("Awaiting approval");
  });

  it("presents escalated queue rows without destinations as Approval recorded", () => {
    expect(
      formatLifecycleStatusLabel({
        status: "escalated",
        escalationRecommendation: "escalate",
      }),
    ).toBe("Approval recorded");
  });

  it("presents escalated detail with known empty destinations as Approved for handoff", () => {
    expect(
      formatLifecycleStatusLabel({
        status: "escalated",
        escalationRecommendation: "escalate",
        downstreamDestinations: [],
      }),
    ).toBe("Approved for handoff");
  });

  it("only claims approval when destination data is unavailable", () => {
    expect(formatLifecycleStatusLabel({ status: "escalated" })).toBe(
      "Approval recorded",
    );
  });

  it("names saved simulated destinations when present", () => {
    expect(
      formatLifecycleStatusLabel({
        status: "escalated",
        downstreamDestinations: ["jira"],
      }),
    ).toBe("Jira issue created");

    expect(
      formatLifecycleStatusLabel({
        status: "escalated",
        downstreamDestinations: ["rootly"],
      }),
    ).toBe("Rootly incident created");

    expect(
      formatLifecycleStatusLabel({
        status: "escalated",
        downstreamDestinations: ["jira", "rootly"],
      }),
    ).toBe("Jira and Rootly created");
  });

  it("does not rewrite investigation-continues presentation", () => {
    expect(
      formatLifecycleStatusLabel({
        status: "investigation_continues",
        escalationRecommendation: "insufficient_evidence",
      }),
    ).toBe("investigation continues");
  });
});
