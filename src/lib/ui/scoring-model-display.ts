/**
 * Presentation helpers for explaining the Escalation Engine scoring model.
 * All weights/thresholds are imported from escalation-rules — never redefined.
 */

import {
  ESCALATION_THRESHOLDS,
  ESCALATION_WEIGHTS,
  EVIDENCE_COMPLETENESS_THRESHOLD,
  SCORE_MAX,
  SCORE_MIN,
} from "@/lib/escalation/escalation-rules";
import { formatSignalLabel } from "@/lib/ui/case-display";
import type { EscalationEngineResult } from "@/types";

export type ScoringModelRow = {
  label: string;
  weight: number;
  /** When true, this row matches the current case value. */
  isCurrent?: boolean;
};

export type ScoringModelGroup = {
  title: string;
  description?: string;
  rows: ScoringModelRow[];
};

function formatWeight(weight: number): string {
  if (weight > 0) {
    return `+${weight}`;
  }
  return String(weight);
}

export { formatWeight };

/** Complete configured scoring model for disclosure — from real constants. */
export function buildScoringModelGroups(options: {
  reportedSeverity?: string;
  aiAssessedSeverity?: string;
}): ScoringModelGroup[] {
  const reported = options.reportedSeverity?.toLowerCase();
  const ai = options.aiAssessedSeverity?.toLowerCase();

  return [
    {
      title: "Customer impact",
      rows: [
        {
          label: "Production environment",
          weight: ESCALATION_WEIGHTS.productionEnvironment,
        },
        {
          label: "Non-production environment",
          weight: ESCALATION_WEIGHTS.nonProductionEnvironment,
        },
        {
          label: "Multiple affected customers (>1)",
          weight: ESCALATION_WEIGHTS.multipleAffectedCustomers,
        },
      ],
    },
    {
      title: "Customer-reported severity",
      rows: [
        {
          label: "Critical",
          weight: ESCALATION_WEIGHTS.reportedSeverityCritical,
          isCurrent: reported === "critical",
        },
        {
          label: "High",
          weight: ESCALATION_WEIGHTS.reportedSeverityHigh,
          isCurrent: reported === "high",
        },
        {
          label: "Medium",
          weight: ESCALATION_WEIGHTS.reportedSeverityMedium,
          isCurrent: reported === "medium",
        },
        {
          label: "Low / otherwise",
          weight: ESCALATION_WEIGHTS.reportedSeverityLow,
          isCurrent: reported === "low",
        },
      ],
    },
    {
      title: "Engineering actionability",
      rows: [
        {
          label: "Suspected product defect",
          weight: ESCALATION_WEIGHTS.suspectedProductDefect,
        },
        {
          label: "Confirmed reproduction",
          weight: ESCALATION_WEIGHTS.confirmedReproducibility,
        },
        {
          label: "Intermittent reproduction",
          weight: ESCALATION_WEIGHTS.intermittentReproducibility,
        },
        {
          label: `Evidence completeness ≥ ${EVIDENCE_COMPLETENESS_THRESHOLD}`,
          weight: ESCALATION_WEIGHTS.evidenceCompletenessHigh,
        },
        {
          label: "Troubleshooting documented",
          weight: ESCALATION_WEIGHTS.troubleshootingCompleted,
        },
        {
          label: "Missing logs and request IDs",
          weight: ESCALATION_WEIGHTS.missingLogsAndRequestIds,
        },
        {
          label: "Configuration or user-error indicator",
          weight: ESCALATION_WEIGHTS.configurationOrUserError,
        },
      ],
    },
    {
      title: "AI supporting signal",
      description:
        "AI severity is intentionally lower-weighted than customer-reported severity and cannot independently determine escalation.",
      rows: [
        {
          label: "AI assessed critical",
          weight: ESCALATION_WEIGHTS.aiSeverityCritical,
          isCurrent: ai === "critical",
        },
        {
          label: "AI assessed high",
          weight: ESCALATION_WEIGHTS.aiSeverityHigh,
          isCurrent: ai === "high",
        },
        {
          label: "AI assessed medium",
          weight: ESCALATION_WEIGHTS.aiSeverityMedium,
          isCurrent: ai === "medium",
        },
        {
          label: "AI assessed low",
          weight: ESCALATION_WEIGHTS.aiSeverityLow,
          isCurrent: ai === "low",
        },
      ],
    },
  ];
}

export type CurrentCaseLine = {
  label: string;
  weight: number;
  explanation?: string;
};

/** Current-case factor lines from persisted engine result only. */
export function buildCurrentCaseCalculation(
  result: EscalationEngineResult,
): {
  lines: CurrentCaseLine[];
  rawTotal: number;
  displayedScore: number;
  wasClamped: boolean;
} {
  const lines: CurrentCaseLine[] = result.contributingFactors.map((factor) => {
    const base = formatSignalLabel(factor.signal);
    let label = base;

    if (factor.signal === "reported_severity") {
      const match = /severity is (\w+)/i.exec(factor.reason);
      label = match
        ? `Customer-reported severity: ${capitalize(match[1])}`
        : "Customer-reported severity";
    } else if (factor.signal === "ai_assessed_severity") {
      const match = /severity is (\w+)/i.exec(factor.reason);
      label = match
        ? `AI-assessed severity: ${capitalize(match[1])}`
        : "AI-assessed severity";
    } else if (factor.signal === "non_production_environment") {
      label = "Non-production environment";
    } else if (factor.signal === "unknown_environment") {
      label = "Unknown environment";
    } else if (factor.signal === "evidence_completeness") {
      label = "Evidence completeness";
    } else if (factor.signal === "reproducibility") {
      label = "Reproducibility";
    }

    const explanation =
      factor.weight === 0 || factor.direction === "decreases"
        ? factor.reason
        : undefined;

    return { label, weight: factor.weight, explanation };
  });

  const rawTotal = lines.reduce((sum, line) => sum + line.weight, 0);
  const displayedScore = result.escalationScore;

  return {
    lines,
    rawTotal,
    displayedScore,
    wasClamped: rawTotal !== displayedScore,
  };
}

export function thresholdBands() {
  return [
    {
      label: "Escalate",
      range: `${ESCALATION_THRESHOLDS.escalateMin}–${SCORE_MAX}`,
      description:
        "Case has sufficient impact/actionability to warrant engineering review.",
    },
    {
      label: "Continue investigation",
      range: `${ESCALATION_THRESHOLDS.continueMin}–${ESCALATION_THRESHOLDS.escalateMin - 1}`,
      description:
        "Some escalation signals exist, but Support investigation should continue.",
    },
    {
      label: "Insufficient evidence",
      range: `${SCORE_MIN}–${ESCALATION_THRESHOLDS.continueMin - 1}`,
      description:
        "The case currently does not meet the evidence/impact threshold for engineering escalation.",
    },
  ] as const;
}

export function escalateThreshold(): number {
  return ESCALATION_THRESHOLDS.escalateMin;
}

export function continueThreshold(): number {
  return ESCALATION_THRESHOLDS.continueMin;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
