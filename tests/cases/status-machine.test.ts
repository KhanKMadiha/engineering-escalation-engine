import { describe, expect, it } from "vitest";
import {
  assertValidTransition,
  canTransition,
  InvalidStatusTransitionError,
  statusAfterEscalationRecommendation,
} from "@/lib/cases/status-machine";

describe("status machine", () => {
  it("accepts valid transitions", () => {
    expect(canTransition("draft", "submitted")).toBe(true);
    expect(canTransition("submitted", "analyzing")).toBe(true);
    expect(canTransition("analyzing", "awaiting_decision")).toBe(true);
    expect(canTransition("analyzing", "investigation_continues")).toBe(true);
    expect(canTransition("awaiting_decision", "analyzing")).toBe(true);
    expect(canTransition("awaiting_decision", "escalated")).toBe(true);
    expect(canTransition("awaiting_decision", "investigation_continues")).toBe(
      true,
    );
    expect(canTransition("awaiting_decision", "closed")).toBe(true);

    expect(() => assertValidTransition("draft", "submitted")).not.toThrow();
  });

  it("Phase 1: escalate recommendations await decision; others continue investigation", () => {
    expect(statusAfterEscalationRecommendation("escalate")).toBe(
      "awaiting_decision",
    );
    expect(statusAfterEscalationRecommendation("continue_investigation")).toBe(
      "investigation_continues",
    );
    expect(statusAfterEscalationRecommendation("insufficient_evidence")).toBe(
      "investigation_continues",
    );
  });

  it("only awaiting_decision can move to escalated; analyzing cannot auto-escalate", () => {
    expect(canTransition("awaiting_decision", "escalated")).toBe(true);
    expect(canTransition("awaiting_decision", "investigation_continues")).toBe(
      true,
    );
    expect(canTransition("analyzing", "escalated")).toBe(false);
    expect(canTransition("submitted", "escalated")).toBe(false);
    expect(canTransition("draft", "investigation_continues")).toBe(false);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("draft", "escalated")).toBe(false);
    expect(canTransition("draft", "draft")).toBe(false);
    expect(canTransition("closed", "draft")).toBe(false);

    expect(() => assertValidTransition("draft", "escalated")).toThrow(
      InvalidStatusTransitionError,
    );
  });
});
