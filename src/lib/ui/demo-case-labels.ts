import {
  isDemoForkCase,
  isSharedFictionalDemoCase,
} from "@/lib/demo/demo-workspace";
import type { CaseRecord, SupportCaseSummary } from "@/types";

export type DemoCaseOwnershipLabel = "Example case" | "Your copy";

type OwnershipInput = Pick<
  CaseRecord,
  "demoWorkspaceId" | "clonedFromCaseId" | "customer" | "issueTitle" | "sourceSystem"
>;

/**
 * Unobtrusive ownership label for shared fictional examples vs visitor forks.
 * Returns null for ordinary (non-demo) cases.
 */
export function demoCaseOwnershipLabel(
  record: OwnershipInput | SupportCaseSummary,
): DemoCaseOwnershipLabel | null {
  if (
    "clonedFromCaseId" in record &&
    isDemoForkCase({
      demoWorkspaceId: record.demoWorkspaceId,
      clonedFromCaseId: record.clonedFromCaseId,
    })
  ) {
    return "Your copy";
  }

  if (
    isSharedFictionalDemoCase({
      demoWorkspaceId: record.demoWorkspaceId ?? null,
      customer: record.customer,
      issueTitle: record.issueTitle,
      sourceSystem:
        "sourceSystem" in record ? (record.sourceSystem ?? null) : null,
    })
  ) {
    return "Example case";
  }

  // Summaries may omit sourceSystem; still label shared demo markers.
  if (
    (record.demoWorkspaceId == null || record.demoWorkspaceId === "") &&
    (record.customer.includes("[DEMO]") || record.issueTitle.includes("[DEMO]"))
  ) {
    return "Example case";
  }

  return null;
}
