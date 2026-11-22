/**
 * Presentation helpers for Escalation approval.
 * Drafts "Reason for escalation" from recorded investigation only —
 * never invents evidence, scores, or automatic approval.
 */

import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import { shortenText } from "@/lib/ui/case-display";
import { supportReproducibilityLabel } from "@/lib/ui/investigation-summary";
import type { CaseRecord } from "@/types";

/**
 * Concise editable reason for escalation.
 * Grounded in recorded investigation; avoids raw error dumps, unsupported
 * hypotheses, and lengthy analysis. Does not approve the case.
 */
export function buildDraftEscalationRationale(record: CaseRecord): string {
  const title = collapseWhitespace(
    stripDemoMarkersForDisplay(record.issueTitle),
  );
  const product = collapseWhitespace(record.product);
  const environment = collapseWhitespace(record.environment);
  const context = [product, environment].filter(Boolean).join(", ");

  const problem = collapseWhitespace(record.actualBehaviour);
  const problemBit = problem
    ? shortenText(problem, 140)
    : title
      ? title
      : "the reported issue";

  const reproducibility = record.analysis?.aiResult.reproducibility;
  const reproduced =
    reproducibility === "confirmed" || reproducibility === "intermittent";

  const evidencePresent =
    (record.analysis?.validatedEvidence?.length ?? 0) > 0 ||
    Boolean(record.troubleshootingPerformed?.trim());

  const parts: string[] = [];

  if (context) {
    parts.push(
      `${context}: ${problemBit}${problemBit.endsWith(".") ? "" : "."}`,
    );
  } else {
    parts.push(`${problemBit}${problemBit.endsWith(".") ? "" : "."}`);
  }

  if (reproduced && evidencePresent) {
    parts.push(
      `Support reproduced the issue (${supportReproducibilityLabel(reproducibility).toLowerCase()}) and recorded investigation evidence that warrants Engineering involvement.`,
    );
  } else if (evidencePresent) {
    parts.push(
      "Recorded investigation evidence warrants Engineering involvement.",
    );
  } else {
    parts.push("Engineering involvement is recommended based on the assessment.");
  }

  return parts.join(" ");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
