import { describe, expect, it } from "vitest";
import {
  caseMatchesReportedRange,
  caseMatchesSearch,
  matchesSearchTokens,
  normalizeSearchText,
} from "@/lib/ui/case-queue-filters";
import type { SupportCaseSummary } from "@/types";

const autoAnswerCase: SupportCaseSummary = {
  id: "33333333-3333-4333-8333-333333333333",
  customer: "[DEMO] Apex Digital",
  product: "MS Teams Integration",
  severity: "high",
  issueTitle: "[DEMO] MS Teams Auto-Answer fails",
  environment: "production",
  status: "investigation_continues",
  createdAt: "2026-09-12T09:15:00.000Z",
  updatedAt: "2026-11-20T14:40:00.000Z",
  escalationRecommendation: "continue_investigation",
  escalationScore: 58,
};

describe("case-queue-filters", () => {
  it("normalises punctuation so hyphenated titles match spaced queries", () => {
    expect(normalizeSearchText("MS Teams Auto-Answer fails")).toBe(
      "ms teams auto answer fails",
    );
    expect(matchesSearchTokens("MS Teams Auto-Answer fails", "auto answer")).toBe(
      true,
    );
  });

  it("matches case-insensitive partial search across id, issue and customer", () => {
    expect(caseMatchesSearch(autoAnswerCase, "auto answer")).toBe(true);
    expect(caseMatchesSearch(autoAnswerCase, "APEX")).toBe(true);
    expect(caseMatchesSearch(autoAnswerCase, "33333333")).toBe(true);
    expect(caseMatchesSearch(autoAnswerCase, "33333333")).toBe(true);
    expect(caseMatchesSearch(autoAnswerCase, "billing outage")).toBe(false);
  });

  it("filters reported date relative to now using createdAt, not updatedAt", () => {
    const now = new Date("2026-11-21T12:00:00.000Z");
    expect(caseMatchesReportedRange(autoAnswerCase.createdAt, "all", now)).toBe(
      true,
    );
    expect(caseMatchesReportedRange(autoAnswerCase.createdAt, "30", now)).toBe(
      false,
    );
    expect(caseMatchesReportedRange(autoAnswerCase.createdAt, "60", now)).toBe(
      false,
    );
    expect(caseMatchesReportedRange(autoAnswerCase.createdAt, "90", now)).toBe(
      true,
    );
    // updatedAt is recent; range must still use createdAt
    expect(
      caseMatchesReportedRange(autoAnswerCase.updatedAt, "30", now),
    ).toBe(true);
  });
});
