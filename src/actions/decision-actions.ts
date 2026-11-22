"use server";

import { revalidatePath } from "next/cache";
import {
  DecisionAlreadyRecordedError,
  DecisionNotEligibleError,
  MissingEscalationResultError,
  CaseNotFoundError,
} from "@/lib/cases/decision-service";
import {
  validateSubmitHumanDecision,
  type DecisionFieldErrors,
} from "@/lib/cases/decision-validators";
import { getDecisionService } from "@/lib/cases/get-decision-service";
import { DemoCaseAccessError } from "@/lib/demo/demo-case-access";
import { ensureDemoWorkspaceForWrite } from "@/lib/demo/demo-workspace-session";
import { resolveWritableDemoCase } from "@/lib/demo/resolve-writable-demo-case";
import {
  isDemoForkCase,
  isSharedFictionalDemoCase,
} from "@/lib/demo/demo-workspace";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";
import { DecisionInProgressError } from "@/lib/security/request-guards";
import { DemoInteractiveWritesDisabledError } from "@/lib/security/runtime-access";
import { logOperationalError } from "@/lib/security/safe-log";

export type SubmitHumanDecisionActionState = {
  ok: boolean;
  message?: string;
  errorCode?: string;
  fieldErrors?: DecisionFieldErrors;
  rationale?: string;
  /** Case id where the decision was recorded, including private copies. */
  caseId?: string;
};

export async function submitHumanDecision(
  _previousState: SubmitHumanDecisionActionState,
  formData: FormData,
): Promise<SubmitHumanDecisionActionState> {
  const caseId = String(formData.get("caseId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "");

  const validation = validateSubmitHumanDecision({
    caseId,
    decision,
    rationale,
  });

  if (!validation.success) {
    return {
      ok: false,
      errorCode: "validation_failed",
      message: validation.formError,
      fieldErrors: validation.fieldErrors,
      rationale,
    };
  }

  try {
    const repository = getCaseRepository();
    const existing = await repository.getCaseById(validation.data.caseId);
    if (!existing) {
      throw new CaseNotFoundError(validation.data.caseId);
    }

    // Soft eligibility before creating a workspace/fork (e.g. Meridian).
    if (isSharedFictionalDemoCase(existing) || isDemoForkCase(existing)) {
      if (existing.decision) {
        throw new DecisionAlreadyRecordedError(existing.id);
      }
      if (existing.status !== "awaiting_decision") {
        throw new DecisionNotEligibleError(
          `Case status "${existing.status}" is not awaiting a human decision.`,
        );
      }
      if (existing.escalationResult?.recommendation !== "escalate") {
        throw new DecisionNotEligibleError(
          `Ordinary human decisions are only allowed when the engine recommends escalation (got "${existing.escalationResult?.recommendation ?? "none"}").`,
        );
      }
    }

    // Shared fictional templates: CoW into a private workspace before deciding.
    // Organisational/local non-template cases decide in place.
    let writableCaseId = validation.data.caseId;
    let isSimulated = false;

    if (isSharedFictionalDemoCase(existing) || isDemoForkCase(existing)) {
      const session = await ensureDemoWorkspaceForWrite(repository);
      const resolved = await resolveWritableDemoCase(
        validation.data.caseId,
        session.workspaceId,
        repository,
      );
      writableCaseId = resolved.record.id;
      isSimulated = true;
    }

    const result = await getDecisionService().recordDecision({
      caseId: writableCaseId,
      decision: validation.data.decision,
      rationale: validation.data.rationale,
      decidedBy: validation.data.decidedBy,
      isSimulated,
    });

    revalidatePath(`/cases/${writableCaseId}`);
    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/");
    revalidatePath("/pending-reviews");

    return {
      ok: true,
      caseId: writableCaseId,
      message:
        result.decision.decision === "approved"
          ? "Escalation approved. Engineering handoff created."
          : "Continue investigation recorded. Engineering handoff was not created.",
    };
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return {
        ok: false,
        errorCode: "not_found",
        message: "Case not found.",
        rationale,
      };
    }
    if (error instanceof DemoInteractiveWritesDisabledError) {
      return {
        ok: false,
        errorCode: "demo_writes_disabled",
        message: error.message,
        rationale,
      };
    }
    if (error instanceof DemoCaseAccessError) {
      return {
        ok: false,
        errorCode: "not_eligible",
        message: error.message,
        rationale,
      };
    }
    if (
      error instanceof DecisionAlreadyRecordedError ||
      error instanceof DecisionInProgressError
    ) {
      return {
        ok: false,
        errorCode: "already_decided",
        message:
          error instanceof DecisionInProgressError
            ? "A decision is already being recorded for this case."
            : error.message,
        rationale,
      };
    }
    if (error instanceof MissingEscalationResultError) {
      return {
        ok: false,
        errorCode: "missing_escalation",
        message: error.message,
        rationale,
      };
    }
    if (error instanceof DecisionNotEligibleError) {
      return {
        ok: false,
        errorCode: "not_eligible",
        message: error.message,
        fieldErrors: { rationale: [error.message] },
        rationale,
      };
    }

    logOperationalError("submitHumanDecision", {
      caseId,
      event: "decision_action_failed",
      errorName: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
    });
    return {
      ok: false,
      errorCode: "unknown",
      message: "Unable to record the decision. Please try again.",
      rationale,
    };
  }
}
