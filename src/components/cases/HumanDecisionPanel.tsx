"use client";

import { useActionState, useState } from "react";
import {
  submitHumanDecision,
  type SubmitHumanDecisionActionState,
} from "@/actions/decision-actions";
import { WorkflowSection } from "@/components/ui/WorkflowSection";
import type { EscalationEngineResult } from "@/types";

const initialState: SubmitHumanDecisionActionState = { ok: true };

type HumanDecisionPanelProps = {
  caseId: string;
  escalationResult: EscalationEngineResult;
};

export function HumanDecisionPanel({
  caseId,
  escalationResult,
}: HumanDecisionPanelProps) {
  const [state, formAction, pending] = useActionState(
    submitHumanDecision,
    initialState,
  );
  const [rationale, setRationale] = useState(state.rationale ?? "");
  const [pendingDecision, setPendingDecision] = useState<
    "approved" | "rejected" | null
  >(null);

  const rationaleValid = rationale.trim().length >= 10;

  function requestConfirm(decision: "approved" | "rejected") {
    if (!rationaleValid) {
      return;
    }
    setPendingDecision(decision);
  }

  return (
    <WorkflowSection
      title="Human approval required"
      description={
        escalationResult.recommendation === "escalate"
          ? "An authorised reviewer must approve this escalation before the case can move to Engineering."
          : "An authorised reviewer must approve escalation or choose to continue investigation."
      }
    >
      <form action={formAction} className="max-w-xl space-y-3">
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <label
            htmlFor="rationale"
            className="block text-sm font-medium text-slate-800"
          >
            Decision rationale <span className="text-red-600">*</span>
          </label>
          <textarea
            id="rationale"
            name="rationale"
            required
            minLength={10}
            rows={4}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            placeholder="Explain why you are approving escalation or continuing investigation."
          />
          <p className="mt-1 text-xs text-slate-500">
            Required. Minimum 10 characters.
          </p>
          {state.fieldErrors?.rationale?.[0] ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {state.fieldErrors.rationale[0]}
            </p>
          ) : null}
        </div>

        {pendingDecision ? (
          <div
            className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">
              Confirm{" "}
              {pendingDecision === "approved"
                ? "approval"
                : "continue investigation"}
              ?
            </p>
            <p className="mt-1 text-xs">
              This cannot be undone. The case will move to{" "}
              {pendingDecision === "approved"
                ? "escalated"
                : "investigation continues"}
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                name="decision"
                value={pendingDecision}
                disabled={pending || !rationaleValid}
                className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Submitting…" : "Confirm decision"}
              </button>
              <button
                type="button"
                onClick={() => setPendingDecision(null)}
                disabled={pending}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !rationaleValid}
              onClick={() => requestConfirm("approved")}
              className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Approve escalation
            </button>
            <button
              type="button"
              disabled={pending || !rationaleValid}
              onClick={() => requestConfirm("rejected")}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue investigation
            </button>
          </div>
        )}

        {!rationaleValid ? (
          <p className="text-xs text-slate-500">
            Enter a rationale of at least 10 characters to enable decision
            buttons.
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
      </form>
    </WorkflowSection>
  );
}
