import { CaseNotFoundError } from "@/lib/cases/case-service";
import {
  assertWorkspaceOwnsCase,
  DemoCaseAccessError,
} from "@/lib/demo/demo-case-access";
import {
  canCreateDownstreamDemo,
  createDemoJiraEscalation,
  createDemoRootlyIncident,
  type DemoJiraResult,
  type DemoRootlyResult,
} from "@/lib/demo/downstream-demo";
import { ensureDemoWorkspaceForWrite } from "@/lib/demo/demo-workspace-session";
import {
  isDemoForkCase,
  isDemoWorkspaceExpired,
  isSharedFictionalDemoCase,
} from "@/lib/demo/demo-workspace";
import { resolveWritableDemoCase } from "@/lib/demo/resolve-writable-demo-case";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type {
  CaseRecord,
  DemoDownstreamDestination,
  DemoDownstreamRecord,
} from "@/types";

export class DownstreamNotEligibleError extends Error {
  readonly code = "DOWNSTREAM_NOT_ELIGIBLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "DownstreamNotEligibleError";
  }
}

export class DownstreamPersistenceUnavailableError extends Error {
  readonly code = "DOWNSTREAM_PERSISTENCE_UNAVAILABLE" as const;

  constructor(
    message = "Simulated downstream persistence is not available.",
  ) {
    super(message);
    this.name = "DownstreamPersistenceUnavailableError";
  }
}

export type CreateDemoDownstreamResult = {
  record: DemoDownstreamRecord;
  caseRecord: CaseRecord;
  /** True when an existing idempotent row was returned. */
  reused: boolean;
  /** True when the visitor was redirected from a shared template to a fork. */
  redirectedFromTemplate: boolean;
  templateCaseId: string | null;
};

/**
 * Soft eligibility check that does not create a workspace or fork.
 * Use before ensureDemoWorkspaceForWrite for invalid attempts (e.g. Meridian).
 */
export function assertDownstreamEligibleOnRecord(record: CaseRecord): void {
  if (!canCreateDownstreamDemo(record)) {
    throw new DownstreamNotEligibleError(
      "A simulated Jira issue or Rootly incident can only be created after escalation is approved and an Engineering handoff exists.",
    );
  }
  if (!record.handoff) {
    throw new DownstreamNotEligibleError(
      "Engineering handoff is required before creating a simulated downstream record.",
    );
  }
}

/**
 * Create or reuse a simulated Jira/Rootly record for the visitor workspace.
 * Never mutates shared templates; never calls external APIs.
 */
export async function createDemoDownstreamRecord(input: {
  caseId: string;
  destination: DemoDownstreamDestination;
  repository: CaseRepository;
}): Promise<CreateDemoDownstreamResult> {
  const { repository, destination } = input;
  if (
    !repository.saveDemoDownstreamRecord ||
    !repository.getDemoDownstreamRecord ||
    !repository.cloneCaseIntoDemoWorkspace
  ) {
    throw new DownstreamPersistenceUnavailableError();
  }

  const existing = await repository.getCaseById(input.caseId);
  if (!existing) {
    throw new CaseNotFoundError(input.caseId);
  }

  // Reject ineligible templates/forks before creating a workspace (Meridian).
  if (isSharedFictionalDemoCase(existing) || isDemoForkCase(existing)) {
    // Vertex template is eligible (approved + handoff). Meridian is not.
    // For forks without approval, also reject early.
    if (!canCreateDownstreamDemo(existing)) {
      assertDownstreamEligibleOnRecord(existing);
    }
  } else if (!canCreateDownstreamDemo(existing)) {
    assertDownstreamEligibleOnRecord(existing);
  }

  const session = await ensureDemoWorkspaceForWrite(repository);
  const workspace = await repository.getDemoWorkspace?.(session.workspaceId);
  if (!workspace || isDemoWorkspaceExpired(workspace)) {
    throw new DemoCaseAccessError(
      "WORKSPACE_MISMATCH",
      "This temporary demo session is not available.",
    );
  }

  const resolved = await resolveWritableDemoCase(
    input.caseId,
    session.workspaceId,
    repository,
  );
  assertWorkspaceOwnsCase(resolved.record, session.workspaceId);
  assertDownstreamEligibleOnRecord(resolved.record);

  const handoff = resolved.record.handoff!;
  const existingRecord = await repository.getDemoDownstreamRecord({
    workspaceId: session.workspaceId,
    caseId: resolved.record.id,
    destination,
  });
  if (existingRecord) {
    return {
      record: existingRecord,
      caseRecord: resolved.record,
      reused: true,
      redirectedFromTemplate: resolved.redirectedFromTemplate,
      templateCaseId: resolved.templateCaseId,
    };
  }

  const built =
    destination === "jira"
      ? createDemoJiraEscalation(handoff, {
          product: resolved.record.product,
          customer: resolved.record.customer,
          incidentTimestamp: resolved.record.incidentTimestamp,
        })
      : createDemoRootlyIncident(handoff, null, {
          product: resolved.record.product,
          customer: resolved.record.customer,
          incidentTimestamp: resolved.record.incidentTimestamp,
        });

  const externalReference =
    destination === "jira"
      ? (built as DemoJiraResult).key
      : (built as DemoRootlyResult).id;

  const now = new Date().toISOString();
  const toSave: DemoDownstreamRecord = {
    id: crypto.randomUUID(),
    demoWorkspaceId: session.workspaceId,
    caseId: resolved.record.id,
    destination,
    externalReference,
    payload: built as unknown as Record<string, unknown>,
    handoffId: handoff.id,
    createdAt: now,
  };

  let saved: DemoDownstreamRecord;
  try {
    saved = await repository.saveDemoDownstreamRecord(toSave);
  } catch (error) {
    // Concurrent create: unique violation → return the winner's row.
    if (
      error instanceof Error &&
      /duplicate|unique|23505/i.test(error.message)
    ) {
      const raced = await repository.getDemoDownstreamRecord({
        workspaceId: session.workspaceId,
        caseId: resolved.record.id,
        destination,
      });
      if (raced) {
        return {
          record: raced,
          caseRecord: resolved.record,
          reused: true,
          redirectedFromTemplate: resolved.redirectedFromTemplate,
          templateCaseId: resolved.templateCaseId,
        };
      }
    }
    throw error;
  }

  return {
    record: saved,
    caseRecord: resolved.record,
    reused: saved.id !== toSave.id,
    redirectedFromTemplate: resolved.redirectedFromTemplate,
    templateCaseId: resolved.templateCaseId,
  };
}

export async function listDemoDownstreamRecordsForVisibleCase(input: {
  caseId: string;
  repository: CaseRepository;
  workspaceId: string | null;
}): Promise<DemoDownstreamRecord[]> {
  if (!input.workspaceId || !input.repository.listDemoDownstreamRecordsForCase) {
    return [];
  }
  const record = await input.repository.getCaseById(input.caseId);
  if (!record) {
    return [];
  }
  try {
    assertWorkspaceOwnsCase(record, input.workspaceId);
  } catch {
    // Templates have no private records; foreign forks are not readable.
    if (!record.demoWorkspaceId) {
      return [];
    }
    return [];
  }
  return input.repository.listDemoDownstreamRecordsForCase({
    workspaceId: input.workspaceId,
    caseId: input.caseId,
  });
}
