"use client";

import { useRouter } from "next/navigation";
import { useActionState, useSyncExternalStore } from "react";
import {
  submitHumanDecision,
  type SubmitHumanDecisionActionState,
} from "@/actions/decision-actions";
import { Button } from "@/components/ui/Button";
import {
  clearApprovalRationaleDraft,
  getApprovalRationaleDraft,
  getApprovalRationaleDraftVersion,
  setApprovalRationaleDraft,
  subscribeApprovalRationaleDrafts,
} from "@/lib/ui/approval-rationale-draft";

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
 *
 * Edited rationale is kept in a case-scoped in-memory draft so switching
 * workflow stages (and remounting this panel) does not discard visitor edits.
 */
export function HumanDecisionPanel({
  caseId,
  initialRationale,
}: HumanDecisionPanelProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previousState: SubmitHumanDecisionActionState, formData: FormData) => {
      const result = await submitHumanDecision(previousState, formData);
      if (!result.ok) {
        if (
          result.rationale != null &&
          getApprovalRationaleDraft(caseId) === undefined
        ) {
          setApprovalRationaleDraft(caseId, result.rationale);
        }
        return result;
      }

      if (result.caseId) {
        clearApprovalRationaleDraft(caseId);
        clearApprovalRationaleDraft(result.caseId);
        if (result.caseId !== caseId) {
          router.push(`/cases/${result.caseId}`);
        }
      }
      return result;
    },
    initialState,
  );

  useSyncExternalStore(
    subscribeApprovalRationaleDrafts,
    getApprovalRationaleDraftVersion,
    getApprovalRationaleDraftVersion,
  );

  // Prefer: in-progress draft (incl. "") → validation echo → suggested text.
  // `??` only falls through when the draft is undefined (never stored).
  const rationale =
    getApprovalRationaleDraft(caseId) ??
    (!state.ok ? state.rationale : undefined) ??
    initialRationale;

  const rationaleValid = rationale.trim().length >= 10;

  function onRationaleChange(value: string) {
    setApprovalRationaleDraft(caseId, value);
  }

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
            onChange={(event) => onRationaleChange(event.target.value)}
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
