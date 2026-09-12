import { createCaseEvent } from "@/lib/audit/case-events";
import {
  AIAnalysisService,
  AnalysisProviderError,
  AnalysisSchemaError,
  type AnalysisModelClient,
  type NormalizedCaseAnalysis,
} from "@/lib/analysis/analyze-case";
import { CaseNotFoundError, CaseService } from "@/lib/cases/case-service";
import { canTransition } from "@/lib/cases/status-machine";
import {
  EscalationEngineError,
  evaluateEscalation,
} from "@/lib/escalation/escalation-engine";
import { buildEscalationSignals } from "@/lib/escalation/signal-builder";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import {
  AnalysisInProgressError,
  releaseAnalysisLock,
  tryAcquireAnalysisLock,
} from "@/lib/security/request-guards";
import { logOperationalError } from "@/lib/security/safe-log";
import type {
  CaseRecord,
  CaseStatus,
  EscalationEngineResult,
  StoredAnalysis,
} from "@/types";

export class CaseNotEligibleForAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseNotEligibleForAnalysisError";
  }
}

export class AnalysisAlreadyCompletedError extends Error {
  constructor(caseId: string) {
    super(
      `Case ${caseId} already has a completed analysis and escalation result. Replacing it is not allowed.`,
    );
    this.name = "AnalysisAlreadyCompletedError";
  }
}

export type AnalysisPipelineSuccess = {
  ok: true;
  caseId: string;
  analysis: NormalizedCaseAnalysis;
  escalationResult: EscalationEngineResult;
  record: CaseRecord;
};

export type AnalysisPipelineFailure = {
  ok: false;
  caseId: string;
  errorCode:
    | "not_found"
    | "not_eligible"
    | "already_completed"
    | "analysis_in_progress"
    | "schema_invalid"
    | "provider_error"
    | "escalation_failed"
    | "unknown";
  message: string;
  record?: CaseRecord;
};

export type AnalysisPipelineResult =
  | AnalysisPipelineSuccess
  | AnalysisPipelineFailure;

const ELIGIBLE_STATUSES: readonly CaseStatus[] = [
  "draft",
  "submitted",
  "analyzing",
];

function toStoredAnalysis(analysis: NormalizedCaseAnalysis): StoredAnalysis {
  return {
    id: analysis.id,
    aiResult: analysis.result,
    validatedEvidence: analysis.evidenceValidation.validatedEvidence,
    rejectedEvidence: analysis.evidenceValidation.rejectedEvidence,
    evidenceCompletenessScore:
      analysis.evidenceValidation.evidenceCompletenessScore,
    provenance: analysis.provenance,
    analysisWarnings: analysis.evidenceValidation.warnings,
    model: analysis.model,
    promptVersion: analysis.promptVersion,
    createdAt: analysis.createdAt,
  };
}

/**
 * Analysis + escalation pipeline.
 *
 * Trust boundaries:
 * - AI output is validated before use.
 * - Escalation Engine is deterministic and separate from AI.
 * - This pipeline never transitions a case to `escalated`.
 */
export class CaseOrchestrator {
  private readonly caseService: CaseService;
  private readonly analysisService: AIAnalysisService;

  constructor(
    private readonly repository: CaseRepository,
    modelClient: AnalysisModelClient,
  ) {
    this.caseService = new CaseService(repository);
    this.analysisService = new AIAnalysisService(modelClient);
  }

  async runAnalysisPipeline(caseId: string): Promise<AnalysisPipelineResult> {
    if (!tryAcquireAnalysisLock(caseId)) {
      return {
        ok: false,
        caseId,
        errorCode: "analysis_in_progress",
        message:
          "Analysis is already in progress for this case. Please wait for it to finish.",
      };
    }

    try {
      return await this.runAnalysisPipelineLocked(caseId);
    } finally {
      releaseAnalysisLock(caseId);
    }
  }

  private async runAnalysisPipelineLocked(
    caseId: string,
  ): Promise<AnalysisPipelineResult> {
    let record: CaseRecord;
    try {
      record = await this.caseService.getCaseById(caseId);
    } catch (error) {
      if (error instanceof CaseNotFoundError) {
        return {
          ok: false,
          caseId,
          errorCode: "not_found",
          message: "Case not found.",
        };
      }
      throw error;
    }

    try {
      this.assertEligibleForAnalysis(record);
      await this.prepareForAnalysis(record);
    } catch (error) {
      if (error instanceof AnalysisAlreadyCompletedError) {
        return {
          ok: false,
          caseId,
          errorCode: "already_completed",
          message: error.message,
          record,
        };
      }
      if (error instanceof AnalysisInProgressError) {
        return {
          ok: false,
          caseId,
          errorCode: "analysis_in_progress",
          message: error.message,
          record,
        };
      }
      if (error instanceof CaseNotEligibleForAnalysisError) {
        return {
          ok: false,
          caseId,
          errorCode: "not_eligible",
          message: error.message,
          record,
        };
      }
      throw error;
    }

    record = await this.caseService.getCaseById(caseId);

    await this.repository.appendEvent(
      caseId,
      createCaseEvent({
        caseId,
        eventType: "analysis_started",
        metadata: { status: record.status },
      }),
    );

    try {
      const analysis = await this.analysisService.analyzeCase(record);
      await this.repository.saveAnalysis(caseId, toStoredAnalysis(analysis));

      await this.repository.appendEvent(
        caseId,
        createCaseEvent({
          caseId,
          eventType: "analysis_completed",
          metadata: {
            analysisId: analysis.id,
            validatedEvidenceCount:
              analysis.evidenceValidation.validatedEvidence.length,
            rejectedEvidenceCount:
              analysis.evidenceValidation.rejectedEvidence.length,
            evidenceCompletenessScore:
              analysis.evidenceValidation.evidenceCompletenessScore,
            warningCount: analysis.evidenceValidation.warnings.length,
          },
        }),
      );

      let escalationResult: EscalationEngineResult;
      try {
        // Rebuild from persisted case + validated analysis only.
        const fresh = await this.caseService.getCaseById(caseId);
        const signals = buildEscalationSignals(fresh, {
          result: analysis.result,
          evidenceValidation: analysis.evidenceValidation,
        });
        escalationResult = evaluateEscalation(signals);
        await this.repository.saveEscalationResult(caseId, escalationResult);
        await this.repository.appendEvent(
          caseId,
          createCaseEvent({
            caseId,
            eventType: "escalation_evaluated",
            metadata: {
              score: escalationResult.escalationScore,
              recommendation: escalationResult.recommendation,
              factorCount: escalationResult.contributingFactors.length,
            },
          }),
        );
      } catch (error) {
        const message =
          error instanceof EscalationEngineError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Escalation evaluation failed";

        logOperationalError("escalation_evaluation", {
          caseId,
          event: "escalation_evaluation_failed",
          errorName: error instanceof Error ? error.name : "unknown",
          message,
        });

        await this.repository.appendEvent(
          caseId,
          createCaseEvent({
            caseId,
            eventType: "escalation_evaluation_failed",
            metadata: { message: message.slice(0, 500) },
          }),
        );

        const failedRecord = await this.caseService.getCaseOrNull(caseId);
        if (failedRecord && canTransition(failedRecord.status, "submitted")) {
          await this.caseService.transitionStatus(caseId, "submitted");
        }

        return {
          ok: false,
          caseId,
          errorCode: "escalation_failed",
          message:
            "AI analysis was saved, but the Escalation Engine failed to evaluate signals. Please retry.",
          record: (await this.caseService.getCaseOrNull(caseId)) ?? undefined,
        };
      }

      const afterEvaluation = await this.caseService.getCaseById(caseId);
      if (canTransition(afterEvaluation.status, "awaiting_decision")) {
        await this.caseService.transitionStatus(caseId, "awaiting_decision");
      }

      const updated = await this.caseService.getCaseById(caseId);
      return {
        ok: true,
        caseId,
        analysis,
        escalationResult,
        record: updated,
      };
    } catch (error) {
      const errorCode =
        error instanceof AnalysisSchemaError
          ? "schema_invalid"
          : error instanceof AnalysisProviderError
            ? "provider_error"
            : "unknown";
      const message =
        error instanceof Error
          ? error.message
          : "Analysis failed for an unknown reason.";

      logOperationalError("analysis_pipeline", {
        caseId,
        event: "analysis_failed",
        errorCode,
        errorName: error instanceof Error ? error.name : "unknown",
        message,
      });

      const current = await this.caseService.getCaseOrNull(caseId);
      if (current && canTransition(current.status, "submitted")) {
        await this.caseService.transitionStatus(caseId, "submitted");
      }

      await this.repository.appendEvent(
        caseId,
        createCaseEvent({
          caseId,
          eventType: "analysis_failed",
          metadata: {
            errorCode,
            message: message.slice(0, 500),
          },
        }),
      );

      const failedRecord = await this.caseService.getCaseOrNull(caseId);
      return {
        ok: false,
        caseId,
        errorCode,
        message:
          errorCode === "schema_invalid"
            ? "AI returned an invalid structured response. Analysis was not saved."
            : errorCode === "provider_error"
              ? "AI provider request failed. Please try again."
              : "Analysis failed. Please try again.",
        record: failedRecord ?? undefined,
      };
    }
  }

  private assertEligibleForAnalysis(record: CaseRecord): void {
    if (record.decision) {
      throw new CaseNotEligibleForAnalysisError(
        "This case already has a human decision and cannot be re-analysed.",
      );
    }

    if (record.status === "analyzing") {
      throw new AnalysisInProgressError(record.id);
    }

    if (
      record.analysis &&
      record.escalationResult &&
      (record.status === "awaiting_decision" ||
        record.status === "escalated" ||
        record.status === "investigation_continues")
    ) {
      throw new AnalysisAlreadyCompletedError(record.id);
    }

    if (!ELIGIBLE_STATUSES.includes(record.status)) {
      throw new CaseNotEligibleForAnalysisError(
        `Case status "${record.status}" is not eligible for analysis.`,
      );
    }
  }

  private async prepareForAnalysis(record: CaseRecord): Promise<void> {
    if (record.status === "draft") {
      await this.caseService.transitionStatus(record.id, "submitted");
    }

    const afterSubmit = await this.caseService.getCaseById(record.id);
    if (afterSubmit.status === "submitted") {
      await this.caseService.transitionStatus(record.id, "analyzing");
    }
  }
}
