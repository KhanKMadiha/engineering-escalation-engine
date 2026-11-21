"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import type { EscalationHandoff } from "@/types";

type CopyHandoffButtonProps = {
  handoff: EscalationHandoff;
};

function buildHandoffPlainText(handoff: EscalationHandoff): string {
  const lines = [
    stripDemoMarkersForDisplay(handoff.title),
    "",
    stripDemoMarkersForDisplay(handoff.summary),
    "",
    `Environment: ${handoff.environment}`,
    `Severity: ${handoff.reportedSeverity}`,
    handoff.affectedCustomerCount !== null
      ? `Affected customer count: ${handoff.affectedCustomerCount}`
      : "Affected customer count: Not provided",
    "",
    "Steps to Reproduce:",
    handoff.stepsToReproduce,
    "",
    "Expected Behaviour:",
    handoff.expectedBehaviour,
    "",
    "Actual Behaviour:",
    handoff.actualBehaviour,
    "",
    "Troubleshooting:",
    handoff.troubleshootingPerformed,
    "",
    `Reproducibility: ${handoff.reproducibility.replaceAll("_", " ")}`,
    `Escalation score: ${handoff.escalationScore} / 100`,
    "",
    "Decision rationale:",
    handoff.decisionRationale,
  ];
  return lines.join("\n");
}

/**
 * Copies the engineering handoff as plain text. Presentation only.
 */
export function CopyHandoffButton({ handoff }: CopyHandoffButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const text = buildHandoffPlainText(handoff);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={onCopy}>
      {copied ? "Copied" : "Copy handoff"}
    </Button>
  );
}
