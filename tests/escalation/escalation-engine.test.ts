import { describe, expect, it } from "vitest";
import {
  clampScore,
  evaluateEscalation,
  recommendationFromScore,
} from "@/lib/escalation/escalation-engine";
import type { EscalationSignals } from "@/lib/escalation/escalation-schema";

function signals(overrides: Partial<EscalationSignals> = {}): EscalationSignals {
  return {
    reportedSeverity: "medium",
    environment: "unknown",
    affectedCustomerCount: null,
    troubleshootingPerformed: false,
    hasLogsOrErrors: false,
    hasRequestIds: false,
    hasIncidentTimestamp: false,
    aiAssessedSeverity: "medium",
    issueCategory: "unknown",
    reproducibility: "unknown",
    suspectedProductDefect: false,
    evidenceCompletenessScore: 0,
    validatedEvidenceCount: 0,
    missingEvidenceCount: 0,
    configurationOrUserErrorIndicator: false,
    ...overrides,
  };
}

describe("Escalation Engine", () => {
  it("Scenario 1: strong production case escalates (score >= 70)", () => {
    const result = evaluateEscalation(
      signals({
        reportedSeverity: "critical",
        environment: "production",
        affectedCustomerCount: 5,
        troubleshootingPerformed: true,
        hasLogsOrErrors: true,
        hasRequestIds: true,
        hasIncidentTimestamp: true,
        aiAssessedSeverity: "critical",
        issueCategory: "bug",
        reproducibility: "confirmed",
        suspectedProductDefect: true,
        evidenceCompletenessScore: 0.875,
        validatedEvidenceCount: 7,
        missingEvidenceCount: 0,
      }),
    );

    expect(result.escalationScore).toBeGreaterThanOrEqual(70);
    expect(result.recommendation).toBe("escalate");
    expect(result.source).toBe("deterministic_engine");
    expect(result.contributingFactors.length).toBeGreaterThan(0);
    expect(result.recommendationReasons.length).toBeGreaterThan(0);
  });

  it("Scenario 2: user error + missing evidence + non-production → insufficient_evidence", () => {
    const result = evaluateEscalation(
      signals({
        reportedSeverity: "low",
        environment: "development",
        troubleshootingPerformed: false,
        hasLogsOrErrors: false,
        hasRequestIds: false,
        aiAssessedSeverity: "low",
        issueCategory: "user_error",
        reproducibility: "not_reproduced",
        suspectedProductDefect: false,
        evidenceCompletenessScore: 0,
        validatedEvidenceCount: 0,
        missingEvidenceCount: 4,
        configurationOrUserErrorIndicator: true,
      }),
    );

    expect(result.escalationScore).toBeLessThan(40);
    expect(result.recommendation).toBe("insufficient_evidence");
    expect(
      result.contributingFactors.some(
        (f) => f.signal === "configuration_or_user_error" && f.weight < 0,
      ),
    ).toBe(true);
  });

  it("Scenario 3: staging + intermittent + troubleshooting → continue_investigation", () => {
    const result = evaluateEscalation(
      signals({
        reportedSeverity: "high",
        environment: "staging",
        affectedCustomerCount: 2,
        troubleshootingPerformed: true,
        hasLogsOrErrors: true,
        hasRequestIds: true,
        aiAssessedSeverity: "high",
        issueCategory: "performance",
        reproducibility: "intermittent",
        suspectedProductDefect: false,
        evidenceCompletenessScore: 0.75,
        validatedEvidenceCount: 3,
        missingEvidenceCount: 1,
      }),
    );

    expect(result.recommendation).toBe("continue_investigation");
    expect(result.escalationScore).toBeGreaterThanOrEqual(40);
    expect(result.escalationScore).toBeLessThan(70);
  });

  it("Scenario 4: missing signals score conservatively and must not escalate", () => {
    const result = evaluateEscalation(signals());
    expect(result.escalationScore).toBeLessThan(70);
    expect(result.recommendation).not.toBe("escalate");
  });

  it("Scenario 5: suspected product defect increases score but does not alone force escalate", () => {
    const without = evaluateEscalation(
      signals({
        suspectedProductDefect: false,
        hasLogsOrErrors: true,
        hasRequestIds: true,
      }),
    );
    const withDefect = evaluateEscalation(
      signals({
        suspectedProductDefect: true,
        hasLogsOrErrors: true,
        hasRequestIds: true,
      }),
    );

    expect(withDefect.escalationScore).toBeGreaterThan(without.escalationScore);
    expect(withDefect.escalationScore).toBeLessThan(70);
    expect(withDefect.recommendation).not.toBe("escalate");
    expect(
      withDefect.contributingFactors.some(
        (f) => f.signal === "suspected_product_defect" && f.weight === 20,
      ),
    ).toBe(true);
  });

  it("Scenario 6: configuration/user-error applies negative scoring", () => {
    const result = evaluateEscalation(
      signals({
        configurationOrUserErrorIndicator: true,
        issueCategory: "configuration",
        hasLogsOrErrors: true,
        hasRequestIds: true,
      }),
    );

    const factor = result.contributingFactors.find(
      (f) => f.signal === "configuration_or_user_error",
    );
    expect(factor?.weight).toBe(-20);
    expect(factor?.direction).toBe("decreases");
  });

  it("Scenario 7: multiple affected customers contribute blast-radius weight", () => {
    const single = evaluateEscalation(
      signals({
        affectedCustomerCount: 1,
        hasLogsOrErrors: true,
        hasRequestIds: true,
      }),
    );
    const multiple = evaluateEscalation(
      signals({
        affectedCustomerCount: 4,
        hasLogsOrErrors: true,
        hasRequestIds: true,
      }),
    );

    expect(multiple.escalationScore).toBe(single.escalationScore + 10);
    expect(
      multiple.contributingFactors.some(
        (f) => f.signal === "multiple_affected_customers" && f.weight === 10,
      ),
    ).toBe(true);
  });

  it("Scenario 8: score boundary thresholds", () => {
    expect(recommendationFromScore(69)).toBe("continue_investigation");
    expect(recommendationFromScore(70)).toBe("escalate");
    expect(recommendationFromScore(39)).toBe("insufficient_evidence");
    expect(recommendationFromScore(40)).toBe("continue_investigation");
  });

  it("Scenario 9: identical inputs produce identical outputs (determinism)", () => {
    const input = signals({
      reportedSeverity: "high",
      environment: "production",
      troubleshootingPerformed: true,
      hasLogsOrErrors: true,
      hasRequestIds: true,
      reproducibility: "confirmed",
      evidenceCompletenessScore: 0.8,
      validatedEvidenceCount: 4,
    });

    const a = evaluateEscalation(input);
    const b = evaluateEscalation(input);
    expect(a).toEqual(b);
  });

  it("Scenario 10: scores are clamped between 0 and 100", () => {
    expect(clampScore(-50)).toBe(0);
    expect(clampScore(150)).toBe(100);

    const heavilyNegative = evaluateEscalation(
      signals({
        environment: "development",
        configurationOrUserErrorIndicator: true,
        issueCategory: "user_error",
        hasLogsOrErrors: false,
        hasRequestIds: false,
        reportedSeverity: "low",
        aiAssessedSeverity: "low",
      }),
    );
    expect(heavilyNegative.escalationScore).toBeGreaterThanOrEqual(0);
    expect(heavilyNegative.escalationScore).toBeLessThanOrEqual(100);

    const heavilyPositive = evaluateEscalation(
      signals({
        reportedSeverity: "critical",
        environment: "production",
        affectedCustomerCount: 10,
        troubleshootingPerformed: true,
        hasLogsOrErrors: true,
        hasRequestIds: true,
        aiAssessedSeverity: "critical",
        issueCategory: "bug",
        reproducibility: "confirmed",
        suspectedProductDefect: true,
        evidenceCompletenessScore: 1,
        validatedEvidenceCount: 8,
      }),
    );
    expect(heavilyPositive.escalationScore).toBeLessThanOrEqual(100);
  });

  it("rejects invalid signals", () => {
    expect(() =>
      evaluateEscalation({
        ...signals(),
        reportedSeverity: "urgent",
      }),
    ).toThrow(/Invalid EscalationSignals/i);
  });

  it("does not use AI escalation assessment as a scoring input", () => {
    const result = evaluateEscalation(
      signals({
        environment: "production",
        reportedSeverity: "medium",
      }),
    );
    expect(
      result.contributingFactors.some((f) =>
        f.signal.includes("ai_escalation_assessment"),
      ),
    ).toBe(false);
  });
});
