import {
  isDemoForkCase,
  isDemoTemplateCase,
} from "@/lib/demo/demo-workspace";
import type { CaseRecord } from "@/types";

export class DemoCaseAccessError extends Error {
  readonly code:
    | "TEMPLATE_IMMUTABLE"
    | "WORKSPACE_MISMATCH"
    | "FORK_REQUIRED"
    | "NOT_READABLE"
    | "APPROVED_TEMPLATE_NO_FORK";

  constructor(
    code: DemoCaseAccessError["code"],
    message: string,
  ) {
    super(message);
    this.name = "DemoCaseAccessError";
    this.code = code;
  }
}

/**
 * Templates are readable by anyone; mutable operations must use a fork.
 */
export function assertTemplateImmutableForMutation(
  record: Pick<CaseRecord, "id" | "demoWorkspaceId">,
): void {
  if (isDemoTemplateCase(record)) {
    throw new DemoCaseAccessError(
      "TEMPLATE_IMMUTABLE",
      "Shared fictional cases cannot be modified. Interactive decisions use a private copy.",
    );
  }
}

/**
 * Forks are only readable/writable by their owning workspace.
 */
export function assertWorkspaceOwnsCase(
  record: Pick<CaseRecord, "demoWorkspaceId" | "clonedFromCaseId" | "id">,
  workspaceId: string,
): void {
  if (isDemoTemplateCase(record)) {
    return;
  }
  if (!isDemoForkCase(record) || record.demoWorkspaceId !== workspaceId) {
    throw new DemoCaseAccessError(
      "WORKSPACE_MISMATCH",
      "This temporary case is not available in the current demo session.",
    );
  }
}

/**
 * Shared templates are always readable. Private forks require a matching workspace.
 */
export function assertCaseReadableByWorkspace(
  record: Pick<CaseRecord, "demoWorkspaceId" | "clonedFromCaseId" | "id">,
  workspaceId: string | null,
): void {
  if (isDemoTemplateCase(record)) {
    return;
  }
  if (!workspaceId || record.demoWorkspaceId !== workspaceId) {
    throw new DemoCaseAccessError(
      "NOT_READABLE",
      "This temporary case is not available in the current demo session.",
    );
  }
}

/**
 * Shared template rows (no workspace id) may be copy-on-write cloned.
 * Forks themselves cannot be re-cloned.
 */
export function assertCanCloneDemoTemplate(record: CaseRecord): void {
  if (!isDemoTemplateCase(record)) {
    throw new DemoCaseAccessError(
      "FORK_REQUIRED",
      "Only shared fictional cases can be copied for interactive work.",
    );
  }
}

/**
 * Simulated approval is only for escalation-ready cases awaiting a decision.
 * Investigation cases (e.g. Meridian) and already-approved templates (e.g. Vertex)
 * are not eligible for a new visitor approval.
 *
 * @deprecated Prefer DecisionService eligibility checks; kept for callers that
 * need an early gate before clone+approve orchestration.
 */
export function assertTemplateEligibleForInteractiveFork(
  record: CaseRecord,
): void {
  assertCanCloneDemoTemplate(record);

  const approved =
    record.status === "escalated" ||
    record.decision?.decision === "approved" ||
    Boolean(record.handoff);

  if (approved) {
    throw new DemoCaseAccessError(
      "APPROVED_TEMPLATE_NO_FORK",
      "This case already has an Engineering handoff. View the original handoff, or use a private copy created by a later write action without recording a second approval.",
    );
  }

  if (record.status !== "awaiting_decision") {
    throw new DemoCaseAccessError(
      "FORK_REQUIRED",
      "Simulated approval is only available for escalation-ready cases awaiting a decision.",
    );
  }

  if (record.escalationResult?.recommendation !== "escalate") {
    throw new DemoCaseAccessError(
      "FORK_REQUIRED",
      "Simulated approval is only available when the engine recommends escalation.",
    );
  }
}

/** True when a template already carries an organisational approval/handoff. */
export function templateHasApprovedHandoff(record: CaseRecord): boolean {
  return (
    record.status === "escalated" ||
    record.decision?.decision === "approved" ||
    Boolean(record.handoff)
  );
}
