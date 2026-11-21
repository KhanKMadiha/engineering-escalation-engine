"use client";

import { useActionState, useState } from "react";
import {
  submitHumanDecision,
  type SubmitHumanDecisionActionState,
} from "@/actions/decision-actions";
import { Button } from "@/components/ui/Button";
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

  const escalateCopy =
    escalationResult.recommendation === "escalate"
      ? "Approve to move this case to Engineering, or continue investigation if more evidence is needed."
      : "Approve escalation only if evidence is sufficient; otherwise continue investigation.";

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        Record decision
      </h2>
      <p className="mt-1.5 text-[15px] text-muted">{escalateCopy}</p>
      <form action={formAction} className="mt-5 max-w-2xl space-y-4">
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <label
            htmlFor="rationale"
            className="block text-[15px] font-medium text-foreground"
          >
            Decision rationale <span className="text-danger">*</span>
          </label>
          <textarea
            id="rationale"
            name="rationale"
            required
            minLength={10}
            rows={4}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[15px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="Explain why you are approving escalation or continuing investigation."
          />
          <p className="mt-1.5 text-sm text-muted">
            Required. Minimum 10 characters.
          </p>
          {state.fieldErrors?.rationale?.[0] ? (
            <p className="mt-1 text-xs text-danger" role="alert">
              {state.fieldErrors.rationale[0]}
            </p>
          ) : null}
        </div>

        {pendingDecision ? (
          <div
            className="rounded border border-amber-200 bg-warning-soft px-3 py-3 text-sm text-amber-950"
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
              <Button
                type="submit"
                name="decision"
                value={pendingDecision}
                disabled={pending || !rationaleValid}
                size="sm"
              >
                {pending ? "Submitting…" : "Confirm decision"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPendingDecision(null)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className="sm:min-w-[12rem]"
              disabled={pending || !rationaleValid}
              onClick={() => requestConfirm("approved")}
            >
              Approve escalation
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="sm:min-w-[12rem]"
              disabled={pending || !rationaleValid}
              onClick={() => requestConfirm("rejected")}
            >
              Continue investigation
            </Button>
          </div>
        )}

        {!rationaleValid ? (
          <p className="text-sm text-muted">
            Enter a rationale of at least 10 characters to enable decision
            buttons.
          </p>
        ) : null}

        {state.message && !pending ? (
          <p
            className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
