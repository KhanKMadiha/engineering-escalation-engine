import { afterEach, describe, expect, it, vi } from "vitest";
import type { SubmitHumanDecisionActionState } from "@/actions/decision-actions";
import { renderToStaticMarkup } from "react-dom/server";
import { HumanDecisionPanel } from "@/components/cases/HumanDecisionPanel";
import {
  getApprovalRationaleDraft,
  resetApprovalRationaleDraftsForTests,
  setApprovalRationaleDraft,
} from "@/lib/ui/approval-rationale-draft";
import { submitHumanDecisionWithDraftLifecycle } from "@/lib/ui/approval-decision-submit";

type DecisionAction = (
  state: SubmitHumanDecisionActionState,
  formData: FormData,
) => Promise<SubmitHumanDecisionActionState>;

const { push, submit, captureAction } = vi.hoisted(() => ({
  push: vi.fn(),
  submit: vi.fn<DecisionAction>(),
  captureAction: vi.fn<(action: DecisionAction) => void>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/actions/decision-actions", () => ({ submitHumanDecision: submit }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useActionState: (
      action: DecisionAction,
      initial: SubmitHumanDecisionActionState,
    ) => {
      captureAction(action);
      return react.useActionState(action, initial);
    },
  };
});

afterEach(() => {
  vi.clearAllMocks();
  resetApprovalRationaleDraftsForTests();
});

describe("HumanDecisionPanel draft preservation", () => {
  const caseId = "ea1437f9-588f-418b-8222-c11079d246c2";
  const suggested =
    "SSO, production: A subset of users fail SAML authentication with signature validation errors while peers succeed. Support reproduced the issue.";

  it("shows the suggested rationale when no draft exists", () => {
    const html = renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );
    expect(html).toContain(suggested);
  });

  it("restores a case-scoped draft after a simulated remount", () => {
    const edited = `${suggested} Edited by visitor before switching tabs.`;
    setApprovalRationaleDraft(caseId, edited);

    const first = renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );
    expect(first).toContain(edited);
    expect(first).not.toContain("Edited by a different case");

    // Simulated unmount + remount after visiting Assessment.
    const second = renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );
    expect(second).toContain(edited);
    expect(getApprovalRationaleDraft(caseId)).toBe(edited);
  });

  it("does not leak drafts across cases", () => {
    setApprovalRationaleDraft(caseId, "Orchid-only draft text for Engineering.");
    const other = renderToStaticMarkup(
      <HumanDecisionPanel
        caseId="997f45ad-f686-4724-a3c1-094d659a3741"
        initialRationale="Meridian suggested text that should remain untouched."
      />,
    );
    expect(other).toContain(
      "Meridian suggested text that should remain untouched.",
    );
    expect(other).not.toContain("Orchid-only draft text");
  });

  it("keeps a cleared rationale empty after remount and disables approval", () => {
    setApprovalRationaleDraft(caseId, "");

    // Unmount + remount (Assessment → Escalation approval).
    const html = renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );

    expect(getApprovalRationaleDraft(caseId)).toBe("");
    expect(html).not.toContain(suggested);
    // SSR renders controlled empty textareas as empty element content (no value=).
    expect(html).toMatch(/<textarea[^>]*><\/textarea>/);
    expect(html).toContain('value="approved" disabled=""');
    expect(html).toContain("Approve escalation");
  });

  it("keeps whitespace-only rationale after remount and disables approval", () => {
    setApprovalRationaleDraft(caseId, "   ");

    const html = renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );

    expect(getApprovalRationaleDraft(caseId)).toBe("   ");
    expect(html).not.toContain(suggested);
    expect(html).toMatch(/<textarea[^>]*> {3}<\/textarea>/);
    expect(html).toContain('value="approved" disabled=""');
    expect(html).toContain("Approve escalation");
  });

  it("clears the shared-case draft before navigating to the successful private copy", async () => {
    const copyId = "private-copy";
    setApprovalRationaleDraft(caseId, "Draft written on the shared example.");
    submit.mockResolvedValueOnce({ ok: true, caseId: copyId });
    push.mockImplementationOnce(() => {
      expect(getApprovalRationaleDraft(caseId)).toBeUndefined();
    });
    renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );

    const [action] = captureAction.mock.lastCall!;
    await action({ ok: true }, new FormData());

    expect(push).toHaveBeenCalledWith(`/cases/${copyId}`);
    const reopenedExample = renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );
    expect(reopenedExample).toContain(suggested);
  });

  it("restores rationale from the failed action and stays on the case", async () => {
    const draft = "  Keep my exact edited rationale.  ";
    setApprovalRationaleDraft(caseId, draft);
    submit.mockResolvedValueOnce({ ok: false, rationale: draft.trim() });
    renderToStaticMarkup(
      <HumanDecisionPanel caseId={caseId} initialRationale={suggested} />,
    );

    const [action] = captureAction.mock.lastCall!;
    await action({ ok: true }, new FormData());

    // Draft lifecycle clears before submit, then restores action rationale.
    expect(getApprovalRationaleDraft(caseId)).toBe(draft.trim());
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the shared-example draft before the server action runs", async () => {
    const visitorDraft =
      "Visitor-edited Orchid rationale that must not linger after approve.";
    setApprovalRationaleDraft(caseId, visitorDraft);

    const formData = new FormData();
    formData.set("caseId", caseId);
    formData.set("decision", "approved");
    formData.set("rationale", visitorDraft);

    const lifecycleSubmit = vi.fn(async () => {
      // Draft must already be cleared before the server action runs.
      expect(getApprovalRationaleDraft(caseId)).toBeUndefined();
      return { ok: true, caseId: "private-copy" };
    });

    const next = await submitHumanDecisionWithDraftLifecycle(
      caseId,
      { ok: true },
      formData,
      lifecycleSubmit,
    );

    expect(next.ok).toBe(true);
    expect(lifecycleSubmit).toHaveBeenCalledOnce();
    expect(getApprovalRationaleDraft(caseId)).toBeUndefined();
  });

  it("restores the exact draft after a failed submission via lifecycle helper", async () => {
    const formData = new FormData();
    formData.set("caseId", caseId);
    formData.set("decision", "approved");
    formData.set("rationale", "   ");

    setApprovalRationaleDraft(caseId, "will be cleared then restored");

    const next = await submitHumanDecisionWithDraftLifecycle(
      caseId,
      { ok: true },
      formData,
      async () => ({
        ok: false,
        message: "validation_failed",
        rationale: "   ",
      }),
    );

    expect(next.ok).toBe(false);
    expect(getApprovalRationaleDraft(caseId)).toBe("   ");
  });

  it("explains the private copy beside decision buttons on shared examples only", () => {
    const shared = renderToStaticMarkup(
      <HumanDecisionPanel
        caseId={caseId}
        initialRationale={suggested}
        isSharedExample
      />,
    );
    expect(shared).toContain(
      "Your decision is saved to a private copy of this case. The shared example stays available for other visitors.",
    );

    const privateCopy = renderToStaticMarkup(
      <HumanDecisionPanel
        caseId="af9e90c6-a008-4f2b-98c4-a268cb79a306"
        initialRationale={suggested}
        isSharedExample={false}
      />,
    );
    expect(privateCopy).not.toContain(
      "Your decision is saved to a private copy of this case.",
    );
  });
});
