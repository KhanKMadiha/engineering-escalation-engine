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
import { submitHumanDecisionWithDraftLifecycle } from "@/lib/ui/approval-decision-submit";

const initialState: SubmitHumanDecisionActionState = { ok: true };

type HumanDecisionPanelProps = {
  caseId: string;
  /** Draft reason from recorded investigation — editable; never auto-approves. */
  initialRationale: string;
  /**
   * When true (shared fictional example), explain that approval writes a
   * private copy and leaves the shared example available.
   */
  isSharedExample?: boolean;
};

/**
 * Human escalation decision form.
 * One deliberate Approve / Continue action — no intermediate confirm step.
 * DecisionService remains the sole mutate path.
 *
 * Edited rationale is kept in a case-scoped in-memory draft so switching
 * workflow stages (and remounting this panel) does not discard visitor edits.
 * The draft is cleared before the server action so successful redirects cannot
 * leave a stale draft on the shared example. On CoW success, navigate to the
 * private copy case id returned by the action.
 */
export function HumanDecisionPanel({
  caseId,
  initialRationale,
  isSharedExample = false,
}: HumanDecisionPanelProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (
      previousState: SubmitHumanDecisionActionState,
      formData: FormData,
    ) => {
      const result = await submitHumanDecisionWithDraftLifecycle(
        caseId,
        previousState,
        formData,
        submitHumanDecision,
      );

      if (result.ok && result.caseId) {
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
    <section className="space-y-3 border-t border-border pt-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <label
            htmlFor="rationale"
            className="block text-sm font-medium text-foreground"
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
            className="mt-1.5 block w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground outline-none transition-colors hover:border-[#d1d5db] focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {state.fieldErrors?.rationale?.[0] ? (
            <p className="mt-1 text-xs text-danger" role="alert">
              {state.fieldErrors.rationale[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2.5">
          {isSharedExample ? (
            <p className="text-sm leading-relaxed text-muted sm:text-right">
              Your decision is saved to a private copy of this case. The shared
              example stays available for other visitors.
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
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
