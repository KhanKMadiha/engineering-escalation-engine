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
import { DecisionInProgressError } from "@/lib/security/request-guards";
import { logOperationalError } from "@/lib/security/safe-log";

export type SubmitHumanDecisionActionState = {
  ok: boolean;
  message?: string;
  errorCode?: string;
  fieldErrors?: DecisionFieldErrors;
  rationale?: string;
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
    const result = await getDecisionService().recordDecision({
      caseId: validation.data.caseId,
      decision: validation.data.decision,
      rationale: validation.data.rationale,
      decidedBy: validation.data.decidedBy,
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/");

    return {
      ok: true,
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
