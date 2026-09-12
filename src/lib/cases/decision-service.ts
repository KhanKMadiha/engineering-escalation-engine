import { createCaseEvent } from "@/lib/audit/case-events";
import {
  DEFAULT_DECIDED_BY,
  validateSubmitHumanDecision,
  type SubmitHumanDecisionInput,
} from "@/lib/cases/decision-validators";
import { CaseNotFoundError, CaseService } from "@/lib/cases/case-service";
import { assertValidTransition } from "@/lib/cases/status-machine";
import { generateEngineeringHandoffFromRecord } from "@/lib/handoff/generate-handoff";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import {
  DecisionInProgressError,
  releaseDecisionLock,
  tryAcquireDecisionLock,
} from "@/lib/security/request-guards";
import { DuplicateDecisionError } from "@/lib/repositories/persistence-errors";
import type {
  CaseRecord,
  EscalationHandoff,
  HumanDecision,
} from "@/types";

export class DecisionNotEligibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionNotEligibleError";
  }
}

export class DecisionAlreadyRecordedError extends Error {
  constructor(caseId: string) {
    super(`A human decision has already been recorded for case ${caseId}`);
    this.name = "DecisionAlreadyRecordedError";
  }
}

export class MissingEscalationResultError extends Error {
  constructor(caseId: string) {
    super(`Case ${caseId} has no escalation result to decide against`);
    this.name = "MissingEscalationResultError";
  }
}

export type RecordHumanDecisionInput = {
  caseId: string;
  decision: "approved" | "rejected";
  rationale: string;
  decidedBy?: string;
};

export type RecordHumanDecisionResult = {
  record: CaseRecord;
  decision: HumanDecision;
  handoff?: EscalationHandoff;
};

/**
 * Owns Phase 5 human decision transitions and handoff creation.
 * Only this service may transition a case to `escalated`.
 * Persistence atomicity is delegated to CaseRepository.persistDecisionOutcome —
 * this service does not import Supabase.
 */
export class DecisionService {
  private readonly caseService: CaseService;

  constructor(private readonly repository: CaseRepository) {
    this.caseService = new CaseService(repository);
  }

  async recordDecision(
    input: RecordHumanDecisionInput,
  ): Promise<RecordHumanDecisionResult> {
    const validation = validateSubmitHumanDecision({
      caseId: input.caseId,
      decision: input.decision,
      rationale: input.rationale,
      decidedBy: input.decidedBy ?? DEFAULT_DECIDED_BY,
    });
    if (!validation.success) {
      const firstError =
        Object.values(validation.fieldErrors).flat()[0] ??
        validation.formError;
      throw new DecisionNotEligibleError(firstError);
    }

    const data: SubmitHumanDecisionInput = validation.data;

    if (!tryAcquireDecisionLock(data.caseId)) {
      throw new DecisionInProgressError(data.caseId);
    }

    try {
      return await this.recordDecisionLocked(data);
    } finally {
      releaseDecisionLock(data.caseId);
    }
  }

  private async recordDecisionLocked(
    data: SubmitHumanDecisionInput,
  ): Promise<RecordHumanDecisionResult> {
    const record = await this.caseService.getCaseById(data.caseId);

    if (record.decision) {
      throw new DecisionAlreadyRecordedError(data.caseId);
    }

    if (record.status !== "awaiting_decision") {
      throw new DecisionNotEligibleError(
        `Case status "${record.status}" is not awaiting a human decision.`,
      );
    }

    if (!record.escalationResult) {
      throw new MissingEscalationResultError(data.caseId);
    }

    const decision: HumanDecision = {
      id: crypto.randomUUID(),
      caseId: data.caseId,
      decision: data.decision,
      rationale: data.rationale,
      decidedAt: new Date().toISOString(),
      decidedBy: data.decidedBy,
      escalationScoreAtDecision: record.escalationResult.escalationScore,
      recommendationAtDecision: record.escalationResult.recommendation,
      source: "human_decision",
    };

    const decisionEvent = createCaseEvent({
      caseId: data.caseId,
      eventType: "human_decision_recorded",
      metadata: {
        decision: decision.decision,
        decidedBy: decision.decidedBy,
        score: decision.escalationScoreAtDecision,
        recommendation: decision.recommendationAtDecision,
        rationale: decision.rationale.slice(0, 500),
      },
    });

    const targetStatus =
      data.decision === "approved" ? "escalated" : "investigation_continues";
    assertValidTransition(record.status, targetStatus);

    let handoff: EscalationHandoff | null = null;
    const events = [decisionEvent];

    if (data.decision === "approved") {
      handoff = generateEngineeringHandoffFromRecord(record, decision);
      events.push(
        createCaseEvent({
          caseId: data.caseId,
          eventType: "engineering_handoff_created",
          metadata: {
            handoffId: handoff.id,
            decisionId: decision.id,
          },
        }),
      );
    }

    events.push(
      createCaseEvent({
        caseId: data.caseId,
        eventType: "status_changed",
        metadata: { from: record.status, to: targetStatus },
      }),
    );

    try {
      await this.repository.persistDecisionOutcome({
        caseId: data.caseId,
        decision,
        handoff,
        targetStatus,
        events,
      });
    } catch (error) {
      if (
        error instanceof DuplicateDecisionError ||
        (error instanceof Error &&
          /already exists|DUPLICATE_DECISION|23505/i.test(error.message))
      ) {
        throw new DecisionAlreadyRecordedError(data.caseId);
      }
      throw error;
    }

    const updated = await this.caseService.getCaseById(data.caseId);
    return {
      record: updated,
      decision,
      handoff: updated.handoff,
    };
  }
}

export { CaseNotFoundError };
