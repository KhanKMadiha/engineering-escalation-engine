import type { SubmitHumanDecisionActionState } from "@/actions/decision-actions";
import {
  clearApprovalRationaleDraft,
  setApprovalRationaleDraft,
} from "@/lib/ui/approval-rationale-draft";

type SubmitHumanDecisionFn = (
  previousState: SubmitHumanDecisionActionState,
  formData: FormData,
) => Promise<SubmitHumanDecisionActionState>;

/**
 * Clears the case-scoped draft before the server action runs so a successful
 * redirect (shared example → private copy) cannot leave a stale draft behind.
 * On failure, restores the exact submitted rationale (including "" / whitespace).
 */
export async function submitHumanDecisionWithDraftLifecycle(
  caseId: string,
  previousState: SubmitHumanDecisionActionState,
  formData: FormData,
  submit: SubmitHumanDecisionFn,
): Promise<SubmitHumanDecisionActionState> {
  clearApprovalRationaleDraft(caseId);

  const next = await submit(previousState, formData);

  if (!next.ok && next.rationale != null) {
    setApprovalRationaleDraft(caseId, next.rationale);
  }

  return next;
}
