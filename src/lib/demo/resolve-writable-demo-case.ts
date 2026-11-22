import {
  assertCanCloneDemoTemplate,
  assertWorkspaceOwnsCase,
  DemoCaseAccessError,
} from "@/lib/demo/demo-case-access";
import {
  isDemoForkCase,
  isSharedFictionalDemoCase,
} from "@/lib/demo/demo-workspace";
import { CaseNotFoundError } from "@/lib/cases/case-service";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type { CaseRecord } from "@/types";

export type ResolveWritableDemoCaseResult = {
  record: CaseRecord;
  /**
   * True when the writable case id differs from the requested id
   * (visitor must continue on the private fork).
   */
  redirectedFromTemplate: boolean;
  /** Template id when the writable record is a fork. */
  templateCaseId: string | null;
};

/**
 * Resolve a visitor-owned mutable case for a supported write.
 * Shared fictional templates are never mutated — they are cloned first.
 * Ordinary (non-demo) cases mutate in place for local/dev workflows.
 */
export async function resolveWritableDemoCase(
  caseId: string,
  workspaceId: string,
  repository: CaseRepository,
): Promise<ResolveWritableDemoCaseResult> {
  const existing = await repository.getCaseById(caseId);
  if (!existing) {
    throw new CaseNotFoundError(caseId);
  }

  if (isDemoForkCase(existing)) {
    assertWorkspaceOwnsCase(existing, workspaceId);
    return {
      record: existing,
      redirectedFromTemplate: false,
      templateCaseId: existing.clonedFromCaseId ?? null,
    };
  }

  if (!isSharedFictionalDemoCase(existing)) {
    return {
      record: existing,
      redirectedFromTemplate: false,
      templateCaseId: null,
    };
  }

  assertCanCloneDemoTemplate(existing);

  if (!repository.cloneCaseIntoDemoWorkspace) {
    throw new DemoCaseAccessError(
      "FORK_REQUIRED",
      "Copy-on-write demo workspaces are not available.",
    );
  }

  const fork = await repository.cloneCaseIntoDemoWorkspace(
    existing.id,
    workspaceId,
  );
  assertWorkspaceOwnsCase(fork, workspaceId);

  return {
    record: fork,
    redirectedFromTemplate: fork.id !== existing.id,
    templateCaseId: existing.id,
  };
}
