import { DEMO_CASE_MARKER } from "@/lib/demo/demo-cases";
import type { CaseRecord, DemoWorkspace } from "@/types";

/** Default anonymous workspace lifetime for portfolio demos. */
export const DEMO_WORKSPACE_TTL_MS = 48 * 60 * 60 * 1000;

/** Cookie name — server-only mechanics; never render this value in UI. */
export const DEMO_WORKSPACE_COOKIE = "eee_demo_workspace";

/**
 * Shared templates (or any non-fork row) have no demoWorkspaceId.
 */
export function isDemoTemplateCase(
  record: Pick<CaseRecord, "demoWorkspaceId">,
): boolean {
  return record.demoWorkspaceId == null || record.demoWorkspaceId === "";
}

/**
 * Shared fictional portfolio cases that must be copy-on-write cloned
 * before visitor mutations. Detected via storage markers, not a schema flag.
 */
export function isSharedFictionalDemoCase(
  record: Pick<
    CaseRecord,
    "demoWorkspaceId" | "customer" | "issueTitle" | "sourceSystem"
  >,
): boolean {
  if (!isDemoTemplateCase(record)) {
    return false;
  }
  return (
    record.customer.includes(DEMO_CASE_MARKER) ||
    record.issueTitle.includes(DEMO_CASE_MARKER) ||
    record.sourceSystem === "demo_freshdesk"
  );
}

/**
 * Visitor forks are mutable only within their owning workspace.
 */
export function isDemoForkCase(
  record: Pick<CaseRecord, "demoWorkspaceId" | "clonedFromCaseId">,
): boolean {
  return Boolean(record.demoWorkspaceId && record.clonedFromCaseId);
}

export function isDemoWorkspaceExpired(
  workspace: Pick<DemoWorkspace, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return new Date(workspace.expiresAt).getTime() <= now.getTime();
}

export function buildDemoWorkspaceExpiry(
  from: Date = new Date(),
  ttlMs: number = DEMO_WORKSPACE_TTL_MS,
): string {
  return new Date(from.getTime() + ttlMs).toISOString();
}
