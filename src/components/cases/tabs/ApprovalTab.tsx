"use client";

import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { HumanDecisionPanel } from "@/components/cases/HumanDecisionPanel";
import { HumanDecisionResultPanel } from "@/components/cases/HumanDecisionResultPanel";
import { EscalationReadinessScore } from "@/components/cases/EscalationReadinessScore";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isSharedFictionalDemoCase } from "@/lib/demo/demo-workspace";
import { buildDraftEscalationRationale } from "@/lib/ui/escalation-approval-summary";
import type { WorkflowStage } from "@/lib/ui/case-workflow-stages";
import type { CaseRecord } from "@/types";

type ApprovalTabProps = {
  record: CaseRecord;
  goToStage: (stage: WorkflowStage) => void;
};

/**
 * Escalation approval — human decision only.
 * Presentation adapts to recommendation / decision state without changing
 * DecisionService, permissions, or stored lifecycle values.
 *
 * Phase 1: ordinary approval is only for escalate + awaiting_decision.
 * Legacy hosted non-escalate rows may still store awaiting_decision; stage
 * availability and DecisionService both keep them out of the approval path.
 */
export function ApprovalTab({ record, goToStage }: ApprovalTabProps) {
  const result = record.escalationResult;
  const decision = record.decision;
  const approved =
    decision?.decision === "approved" || record.status === "escalated";
  const continueInvestigation =
    decision?.decision === "rejected" ||
    record.status === "investigation_continues";
  const recommendation = result?.recommendation;
  const needsFurtherInvestigation =
    recommendation === "insufficient_evidence" ||
    recommendation === "continue_investigation";
  const escalateReady =
    recommendation === "escalate" &&
    record.status === "awaiting_decision" &&
    !decision;

  const draftRationale = escalateReady
    ? buildDraftEscalationRationale(record)
    : "";

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-3"
      sidebarClassName="space-y-3"
      main={
        <>
          {approved && decision ? (
            <Card padding="sm" className="space-y-4">
              <HumanDecisionResultPanel
                decision={decision}
                caseStatus={record.status}
              />
              {record.handoff ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => goToStage("Create escalation")}
                >
                  Open Create escalation →
                </Button>
              ) : null}
            </Card>
          ) : null}

          {approved && !decision ? (
            <Card padding="sm">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Approved for handoff
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                This case is approved for handoff. Open Create escalation to
                review the prepared package and create simulated destination
                records.
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-4"
                onClick={() => goToStage("Create escalation")}
              >
                Open Create escalation →
              </Button>
            </Card>
          ) : null}

          {continueInvestigation && decision ? (
            <Card padding="sm" className="space-y-4">
              <HumanDecisionResultPanel
                decision={decision}
                caseStatus={record.status}
              />
              <p className="text-[15px] leading-relaxed text-muted">
                Escalation approval is not required while investigation
                continues.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => goToStage("Assessment")}
              >
                Review assessment →
              </Button>
            </Card>
          ) : null}

          {!decision && needsFurtherInvestigation ? (
            <Card padding="sm">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Escalation approval not required
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
                {recommendation === "insufficient_evidence"
                  ? "Further evidence is needed before an escalation decision. Review the Assessment, then continue investigation."
                  : "Continued investigation is recommended. An escalation approval is not required at this stage."}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={() => goToStage("Assessment")}
              >
                Review assessment →
              </Button>
            </Card>
          ) : null}

          {escalateReady && result ? (
            <Card padding="sm" className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Escalation approval
              </h2>

              <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Engine recommendation
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    Escalate to Engineering
                  </p>
                </div>
                <div className="shrink-0">
                  <EscalationReadinessScore score={result.escalationScore} />
                </div>
              </div>

              {isSharedFictionalDemoCase(record) ? (
                <p className="text-sm text-muted">
                  Your decision is saved to a private copy of this case. The
                  shared example stays available for other visitors.
                </p>
              ) : null}

              <HumanDecisionPanel
                caseId={record.id}
                initialRationale={draftRationale}
                isSharedExample={isSharedFictionalDemoCase(record)}
              />
            </Card>
          ) : null}

          {!result && !decision ? (
            <Card padding="sm">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Escalation approval
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Escalation has not been assessed yet. Review Assessment before a
                decision can be recorded.
              </p>
            </Card>
          ) : null}
        </>
      }
      sidebar={<CaseDetailsCard record={record} />}
    />
  );
}
