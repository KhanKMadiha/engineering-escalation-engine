"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CaseNotFoundError } from "@/lib/cases/case-service";
import { DemoCaseAccessError } from "@/lib/demo/demo-case-access";
import {
  createDemoDownstreamRecord,
  DownstreamNotEligibleError,
  DownstreamPersistenceUnavailableError,
} from "@/lib/demo/downstream-record-service";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";
import { DemoInteractiveWritesDisabledError } from "@/lib/security/runtime-access";
import { logOperationalError } from "@/lib/security/safe-log";
import type { DemoDownstreamDestination, DemoDownstreamRecord } from "@/types";

export type CreateDemoDownstreamActionState = {
  ok: boolean;
  message?: string;
  errorCode?: string;
  caseId?: string;
  record?: DemoDownstreamRecord;
  reused?: boolean;
};

function isNextRedirect(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const digest = "digest" in error ? (error as { digest?: unknown }).digest : null;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * Persist a simulated Jira issue or Rootly incident for the visitor workspace.
 * Never calls external APIs. Idempotent per destination per case per workspace.
 */
export async function createDemoDownstreamAction(
  _previous: CreateDemoDownstreamActionState,
  formData: FormData,
): Promise<CreateDemoDownstreamActionState> {
  const caseId = String(formData.get("caseId") ?? "").trim();
  const destinationRaw = String(formData.get("destination") ?? "").trim();
  const destination =
    destinationRaw === "jira" || destinationRaw === "rootly"
      ? (destinationRaw as DemoDownstreamDestination)
      : null;

  if (!caseId || !destination) {
    return {
      ok: false,
      errorCode: "validation_failed",
      message: "Case and destination are required.",
      caseId,
    };
  }

  try {
    const result = await createDemoDownstreamRecord({
      caseId,
      destination,
      repository: getCaseRepository(),
    });

    revalidatePath(`/cases/${result.caseRecord.id}`);
    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/");

    if (
      result.redirectedFromTemplate &&
      result.caseRecord.id !== caseId
    ) {
      // Continue on the private fork so refresh keeps the saved record.
      redirect(`/cases/${result.caseRecord.id}?downstream=${destination}`);
    }

    return {
      ok: true,
      caseId: result.caseRecord.id,
      record: result.record,
      reused: result.reused,
      message:
        destination === "jira"
          ? result.reused
            ? "Simulated Jira issue already created"
            : "Simulated Jira issue created"
          : result.reused
            ? "Simulated Rootly incident already created"
            : "Simulated Rootly incident created",
    };
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    if (error instanceof CaseNotFoundError) {
      return {
        ok: false,
        errorCode: "not_found",
        message: "Case not found.",
        caseId,
      };
    }
    if (error instanceof DemoInteractiveWritesDisabledError) {
      return {
        ok: false,
        errorCode: "demo_writes_disabled",
        message: error.message,
        caseId,
      };
    }
    if (error instanceof DownstreamNotEligibleError) {
      return {
        ok: false,
        errorCode: "not_eligible",
        message: error.message,
        caseId,
      };
    }
    if (error instanceof DemoCaseAccessError) {
      return {
        ok: false,
        errorCode: "forbidden",
        message: error.message,
        caseId,
      };
    }
    if (error instanceof DownstreamPersistenceUnavailableError) {
      return {
        ok: false,
        errorCode: "unavailable",
        message: error.message,
        caseId,
      };
    }

    logOperationalError("createDemoDownstreamAction", {
      caseId,
      event: "downstream_create_failed",
      errorName: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
    });
    return {
      ok: false,
      errorCode: "unknown",
      message: "Unable to create the simulated record. Please try again.",
      caseId,
    };
  }
}
