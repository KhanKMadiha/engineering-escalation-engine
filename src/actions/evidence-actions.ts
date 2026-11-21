"use server";

import { revalidatePath } from "next/cache";
import {
  EvidenceAccessError,
  EvidenceNotFoundError,
} from "@/lib/evidence/evidence-service";
import {
  createEvidenceInputFromFormData,
  updateEvidenceInputFromFormData,
  validateCreateTechnicalEvidence,
  validateUpdateTechnicalEvidence,
} from "@/lib/evidence/evidence-validators";
import { getEvidenceService } from "@/lib/evidence/get-evidence-service";
import { CaseNotFoundError } from "@/lib/cases/case-service";
import { logOperationalError } from "@/lib/security/safe-log";

const CASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EvidenceActionState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Record<string, string>;
  evidenceId?: string;
};

function assertCaseId(caseId: string): boolean {
  return CASE_ID_PATTERN.test(caseId);
}

export async function createTechnicalEvidenceAction(
  _previous: EvidenceActionState,
  formData: FormData,
): Promise<EvidenceActionState> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!assertCaseId(caseId)) {
    return { ok: false, formError: "Invalid case." };
  }

  const validation = validateCreateTechnicalEvidence(
    createEvidenceInputFromFormData(formData, caseId),
  );
  if (!validation.success) {
    return {
      ok: false,
      formError: validation.formError,
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const created = await getEvidenceService().create(validation.data);

    const file = formData.get("screenshot");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await getEvidenceService().addScreenshot({
        caseId,
        evidenceId: created.id,
        fileName: file.name,
        contentType: file.type,
        bytes,
      });
    }

    revalidatePath(`/cases/${caseId}`);
    return { ok: true, evidenceId: created.id };
  } catch (error) {
    logOperationalError("createTechnicalEvidence", {
      event: "technical_evidence_create_failed",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    if (error instanceof CaseNotFoundError) {
      return { ok: false, formError: "Case not found." };
    }
    if (error instanceof EvidenceAccessError) {
      return { ok: false, formError: error.message };
    }
    return { ok: false, formError: "Unable to save evidence. Please try again." };
  }
}

export async function updateTechnicalEvidenceAction(
  caseId: string,
  evidenceId: string,
  formData: FormData,
): Promise<EvidenceActionState> {
  if (!assertCaseId(caseId) || !assertCaseId(evidenceId)) {
    return { ok: false, formError: "Invalid request." };
  }
  const validation = validateUpdateTechnicalEvidence(
    updateEvidenceInputFromFormData(formData),
  );
  if (!validation.success) {
    return {
      ok: false,
      formError: validation.formError,
      fieldErrors: validation.fieldErrors,
    };
  }
  try {
    await getEvidenceService().update(caseId, evidenceId, validation.data);
    revalidatePath(`/cases/${caseId}`);
    return { ok: true, evidenceId };
  } catch (error) {
    logOperationalError("updateTechnicalEvidence", {
      event: "technical_evidence_update_failed",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    if (
      error instanceof CaseNotFoundError ||
      error instanceof EvidenceNotFoundError
    ) {
      return { ok: false, formError: "Evidence not found for this case." };
    }
    if (error instanceof EvidenceAccessError) {
      return { ok: false, formError: error.message };
    }
    return { ok: false, formError: "Unable to update evidence." };
  }
}

export async function deleteTechnicalEvidenceAction(
  caseId: string,
  evidenceId: string,
): Promise<EvidenceActionState> {
  if (!assertCaseId(caseId) || !assertCaseId(evidenceId)) {
    return { ok: false, formError: "Invalid request." };
  }
  try {
    await getEvidenceService().delete(caseId, evidenceId);
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (error) {
    logOperationalError("deleteTechnicalEvidence", {
      event: "technical_evidence_delete_failed",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    if (
      error instanceof CaseNotFoundError ||
      error instanceof EvidenceNotFoundError
    ) {
      return { ok: false, formError: "Evidence not found for this case." };
    }
    return { ok: false, formError: "Unable to delete evidence." };
  }
}

export async function addEvidenceScreenshotAction(
  caseId: string,
  evidenceId: string,
  formData: FormData,
): Promise<EvidenceActionState> {
  if (!assertCaseId(caseId) || !assertCaseId(evidenceId)) {
    return { ok: false, formError: "Invalid request." };
  }
  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, formError: "Choose a PNG, JPEG, or WebP image." };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await getEvidenceService().addScreenshot({
      caseId,
      evidenceId,
      fileName: file.name,
      contentType: file.type,
      bytes,
    });
    revalidatePath(`/cases/${caseId}`);
    return { ok: true, evidenceId };
  } catch (error) {
    if (error instanceof EvidenceAccessError) {
      return { ok: false, formError: error.message };
    }
    return { ok: false, formError: "Unable to upload screenshot." };
  }
}
