"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCaseInputFromFormData,
  validateCreateCaseInput,
  type FieldErrors,
} from "@/lib/cases/case-validators";
import { getCaseOrchestrator } from "@/lib/cases/get-case-orchestrator";
import { getCaseService } from "@/lib/cases/get-case-service";
import { logOperationalError } from "@/lib/security/safe-log";

export type CreateCaseActionState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

function formDataToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}

export async function createCase(
  _previousState: CreateCaseActionState,
  formData: FormData,
): Promise<CreateCaseActionState> {
  const values = formDataToValues(formData);
  const validation = validateCreateCaseInput(
    createCaseInputFromFormData(formData),
  );

  if (!validation.success) {
    return {
      ok: false,
      formError: validation.formError,
      fieldErrors: validation.fieldErrors,
      values,
    };
  }

  let caseId: string;
  try {
    const created = await getCaseService().createCase(validation.data);
    caseId = created.id;
  } catch (error) {
    logOperationalError("createCase", {
      event: "create_case_failed",
      errorName: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
    });
    return {
      ok: false,
      formError: "Unable to create the case. Please try again.",
      values,
    };
  }

  redirect(`/cases/${caseId}`);
}

export type SubmitAnalysisActionState = {
  ok: boolean;
  message?: string;
  errorCode?: string;
};

const CASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function submitCaseForAnalysis(
  _previousState: SubmitAnalysisActionState,
  formData: FormData,
): Promise<SubmitAnalysisActionState> {
  const caseId = String(formData.get("caseId") ?? "").trim();
  if (!caseId || !CASE_ID_PATTERN.test(caseId)) {
    return {
      ok: false,
      errorCode: "invalid_id",
      message: "A valid case ID is required.",
    };
  }

  try {
    const result = await getCaseOrchestrator().runAnalysisPipeline(caseId);

    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/");

    if (!result.ok) {
      return {
        ok: false,
        errorCode: result.errorCode,
        message: result.message,
      };
    }

    return {
      ok: true,
      message:
        "Analysis completed. Review the Escalation Engine recommendation and decide.",
    };
  } catch (error) {
    logOperationalError("submitCaseForAnalysis", {
      caseId,
      event: "analysis_action_failed",
      errorName: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
    });
    return {
      ok: false,
      errorCode: "unknown",
      message:
        error instanceof Error && error.message.includes("OPENAI_API_KEY")
          ? "OpenAI API key is not configured on the server."
          : "Unable to run analysis. Please try again.",
    };
  }
}
