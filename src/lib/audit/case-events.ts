import type { CaseEvent, CaseEventType } from "@/types";

export type CreateCaseEventInput = {
  caseId: string;
  eventType: CaseEventType;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  id?: string;
};

/**
 * Builds a CaseEvent for the audit trail.
 * Pure helper — does not persist; callers pass the result to CaseRepository.appendEvent.
 */
export function createCaseEvent(input: CreateCaseEventInput): CaseEvent {
  return {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    eventType: input.eventType,
    metadata: input.metadata,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
