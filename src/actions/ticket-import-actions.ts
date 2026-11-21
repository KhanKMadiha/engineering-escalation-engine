"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCaseFromTicketImport,
  DuplicateTicketImportError,
  listImportableTickets,
  previewTicketImport,
  resolveTicketProviders,
} from "@/lib/integrations/ticket-import-service";
import type { TicketImportDraft } from "@/lib/integrations/ticket-provider";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";
import { logOperationalError } from "@/lib/security/safe-log";
import type { CreateCaseInput } from "@/types";

export type TicketProviderOption = {
  id: string;
  label: string;
};

export async function listTicketProvidersAction(): Promise<
  TicketProviderOption[]
> {
  return resolveTicketProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
  }));
}

export async function listTicketsAction(providerId: string) {
  return listImportableTickets(providerId);
}

export async function previewTicketAction(input: {
  providerId: string;
  externalTicketId: string;
}): Promise<TicketImportDraft> {
  return previewTicketImport(input);
}

export type ConfirmImportState = {
  ok: boolean;
  formError?: string;
  existingCaseId?: string;
};

export async function confirmTicketImportAction(
  _previous: ConfirmImportState,
  formData: FormData,
): Promise<ConfirmImportState> {
  const draftJson = String(formData.get("draftJson") ?? "");
  let draft: CreateCaseInput;
  try {
    draft = JSON.parse(draftJson) as CreateCaseInput;
  } catch {
    return { ok: false, formError: "Import draft was invalid. Please preview again." };
  }

  // Apply reviewer edits from the preview form.
  draft = {
    ...draft,
    customer: String(formData.get("customer") ?? draft.customer),
    product: String(formData.get("product") ?? draft.product),
    severity: String(formData.get("severity") ?? draft.severity) as CreateCaseInput["severity"],
    environment: String(
      formData.get("environment") ?? draft.environment,
    ) as CreateCaseInput["environment"],
    issueTitle: String(formData.get("issueTitle") ?? draft.issueTitle),
    issueDescription: String(
      formData.get("issueDescription") ?? draft.issueDescription,
    ),
    troubleshootingPerformed: String(
      formData.get("troubleshootingPerformed") ?? draft.troubleshootingPerformed,
    ),
    logsErrors: String(formData.get("logsErrors") ?? draft.logsErrors),
    requestIds: String(formData.get("requestIds") ?? draft.requestIds),
    stepsToReproduce: String(
      formData.get("stepsToReproduce") ?? draft.stepsToReproduce,
    ),
    expectedBehaviour: String(
      formData.get("expectedBehaviour") ?? draft.expectedBehaviour,
    ),
    actualBehaviour: String(
      formData.get("actualBehaviour") ?? draft.actualBehaviour,
    ),
  };

  try {
    const created = await createCaseFromTicketImport({
      repository: getCaseRepository(),
      draft,
    });
    revalidatePath("/");
    redirect(`/cases/${created.id}`);
  } catch (error) {
    if (error instanceof DuplicateTicketImportError) {
      return {
        ok: false,
        formError: error.message,
        existingCaseId: error.existingCaseId,
      };
    }
    logOperationalError("confirmTicketImport", {
      event: "ticket_import_failed",
      errorName: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
    });
    return {
      ok: false,
      formError:
        error instanceof Error
          ? error.message
          : "Unable to import the ticket. Please try again.",
    };
  }
}
