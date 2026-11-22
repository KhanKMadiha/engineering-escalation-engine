import { describe, expect, it } from "vitest";
import { demoCaseOwnershipLabel } from "@/lib/ui/demo-case-labels";
import { buildCaseQueueStats } from "@/lib/ui/case-queue-stats";
import type { SupportCaseSummary } from "@/types";

function summary(
  partial: Partial<SupportCaseSummary> &
    Pick<SupportCaseSummary, "id" | "status" | "customer" | "issueTitle">,
): SupportCaseSummary {
  return {
    product: "SSO",
    severity: "high",
    environment: "production",
    createdAt: "2026-06-25T12:00:00.000Z",
    updatedAt: "2026-06-25T12:00:00.000Z",
    ...partial,
  };
}

describe("demoCaseOwnershipLabel", () => {
  it("labels shared fictional templates as Example case", () => {
    expect(
      demoCaseOwnershipLabel(
        summary({
          id: "orchid-template",
          status: "awaiting_decision",
          customer: "[DEMO] Orchid Health",
          issueTitle: "[DEMO] SAML SSO failing for some users",
          escalationRecommendation: "escalate",
          demoWorkspaceId: null,
          clonedFromCaseId: null,
        }),
      ),
    ).toBe("Example case");
  });

  it("labels visitor forks as Your copy", () => {
    expect(
      demoCaseOwnershipLabel(
        summary({
          id: "orchid-fork",
          status: "escalated",
          customer: "[DEMO] Orchid Health",
          issueTitle: "[DEMO] SAML SSO failing for some users",
          escalationRecommendation: "escalate",
          demoWorkspaceId: "11111111-1111-4111-8111-111111111111",
          clonedFromCaseId: "orchid-template",
        }),
      ),
    ).toBe("Your copy");
  });

  it("returns null for ordinary non-demo cases", () => {
    expect(
      demoCaseOwnershipLabel(
        summary({
          id: "real-case",
          status: "submitted",
          customer: "Acme Corp",
          issueTitle: "Login failure",
        }),
      ),
    ).toBeNull();
  });
});

describe("pending reviews counts with shared examples + private copies", () => {
  it("keeps the shared Orchid example in awaiting review after a private copy exists", () => {
    const stats = buildCaseQueueStats([
      summary({
        id: "orchid-template",
        status: "awaiting_decision",
        customer: "[DEMO] Orchid Health",
        issueTitle: "[DEMO] SAML SSO failing",
        escalationRecommendation: "escalate",
        demoWorkspaceId: null,
      }),
      summary({
        id: "orchid-fork",
        status: "escalated",
        customer: "[DEMO] Orchid Health",
        issueTitle: "[DEMO] SAML SSO failing",
        escalationRecommendation: "escalate",
        demoWorkspaceId: "ws-1",
        clonedFromCaseId: "orchid-template",
      }),
      summary({
        id: "meridian",
        status: "investigation_continues",
        customer: "[DEMO] Meridian Systems",
        issueTitle: "[DEMO] SSO login fails",
        escalationRecommendation: "insufficient_evidence",
      }),
    ]);

    expect(stats.awaitingReview).toBe(1);
    expect(stats.readyForHandoff).toBe(1);
    expect(stats.total).toBe(3);
  });
});
