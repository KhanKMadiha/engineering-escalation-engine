"use client";

import { useActionState, useState } from "react";
import {
  submitHumanDecision,
  type SubmitHumanDecisionActionState,
} from "@/actions/decision-actions";
import { Button } from "@/components/ui/Button";

const initialState: SubmitHumanDecisionActionState = { ok: true };

type HumanDecisionPanelProps = {
  caseId: string;
  /** Draft reason from recorded investigation — editable; never auto-approves. */
  initialRationale: string;
};

/**
 * Human escalation decision form.
 * One deliberate Approve / Continue action — no intermediate confirm step.
 * DecisionService remains the sole mutate path.
 */
export function HumanDecisionPanel({
  caseId,
  initialRationale,
}: HumanDecisionPanelProps) {
  const [state, formAction, pending] = useActionState(
    submitHumanDecision,
    initialState,
  );
  const [rationale, setRationale] = useState(
    state.rationale ?? initialRationale,
  );

  const rationaleValid = rationale.trim().length >= 10;

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <label
            htmlFor="rationale"
            className="block text-[15px] font-medium text-foreground"
          >
            Reason for escalation <span className="text-danger">*</span>
          </label>
          <textarea
            id="rationale"
            name="rationale"
            required
            minLength={10}
            rows={4}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {state.fieldErrors?.rationale?.[0] ? (
            <p className="mt-1 text-xs text-danger" role="alert">
              {state.fieldErrors.rationale[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            name="decision"
            value="rejected"
            variant="secondary"
            size="lg"
            className="sm:min-w-[12rem]"
            disabled={pending || !rationaleValid}
          >
            {pending ? "Submitting…" : "Continue investigation"}
          </Button>
          <Button
            type="submit"
            name="decision"
            value="approved"
            variant="primary"
            size="lg"
            className="sm:min-w-[12rem]"
            disabled={pending || !rationaleValid}
          >
            {pending ? "Submitting…" : "Approve escalation"}
          </Button>
        </div>

        {state.message && !pending ? (
          <p
            className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
