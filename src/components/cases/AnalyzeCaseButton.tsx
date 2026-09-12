"use client";

import { useActionState } from "react";
import {
  submitCaseForAnalysis,
  type SubmitAnalysisActionState,
} from "@/actions/case-actions";
import type { CaseStatus } from "@/types";

const initialState: SubmitAnalysisActionState = { ok: true };

type AnalyzeCaseButtonProps = {
  caseId: string;
  status: CaseStatus;
  hasAnalysis: boolean;
  hasEscalationResult?: boolean;
};

function canStartAnalysis(
  status: CaseStatus,
  hasAnalysis: boolean,
  hasEscalationResult: boolean,
): boolean {
  if (status === "analyzing") {
    return false;
  }
  if (hasAnalysis && hasEscalationResult) {
    return false;
  }
  return status === "draft" || status === "submitted";
}

export function AnalyzeCaseButton({
  caseId,
  status,
  hasAnalysis,
  hasEscalationResult = false,
}: AnalyzeCaseButtonProps) {
  const [state, formAction, pending] = useActionState(
    submitCaseForAnalysis,
    initialState,
  );

  if (status === "analyzing") {
    return (
      <p className="text-xs text-slate-600" aria-live="polite">
        Analysis in progress. Concurrent analysis requests are blocked.
      </p>
    );
  }

  if (hasAnalysis && hasEscalationResult) {
    return (
      <p className="text-xs text-slate-600">
        Analysis complete. Completed results are not replaced. Use the human
        decision panel to approve or reject the Escalation Engine recommendation.
      </p>
    );
  }

  if (!canStartAnalysis(status, hasAnalysis, hasEscalationResult)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="caseId" value={caseId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Running analysis…" : "Run AI analysis"}
        </button>
      </form>
      {pending ? (
        <p className="text-xs text-slate-600" aria-live="polite">
          Analysis in progress. This may take a moment.
        </p>
      ) : null}
      {state.message && !pending ? (
        <p
          className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
