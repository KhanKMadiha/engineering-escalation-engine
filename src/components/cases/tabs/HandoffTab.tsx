import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CreateEscalationApprovedView } from "@/components/cases/CreateEscalationApprovedView";
import { HandoffSummarySidebar } from "@/components/cases/HandoffSummarySidebar";
import { canCreateDownstreamDemo } from "@/lib/demo/downstream-demo";
import type { CaseRecord, DemoDownstreamRecord } from "@/types";

type HandoffTabProps = {
  record: CaseRecord;
  existingDownstreamRecords?: DemoDownstreamRecord[];
};

/**
 * Create escalation stage (user-facing).
 * Domain package remains engineering_handoffs / EscalationHandoff.
 * Landing screen stays concise — full package detail appears in destination previews.
 */
export function HandoffTab({
  record,
  existingDownstreamRecords = [],
}: HandoffTabProps) {
  const approved = canCreateDownstreamDemo(record);
  const continueInvestigation =
    record.decision?.decision === "rejected" ||
    record.status === "investigation_continues";
  const insufficient =
    record.escalationResult?.recommendation === "insufficient_evidence" &&
    !record.handoff;

  if (record.handoff && approved) {
    return (
      <CaseDetailTwoColumnLayout
        mainClassName="space-y-5"
        main={
          <CreateEscalationApprovedView
            caseId={record.id}
            handoff={record.handoff}
            product={record.product}
            customer={record.customer}
            incidentTimestamp={record.incidentTimestamp}
            existingDownstreamRecords={existingDownstreamRecords}
          />
        }
        sidebar={<HandoffSummarySidebar record={record} />}
      />
    );
  }

  let description =
    "Create escalation becomes available after escalation is approved.";

  if (continueInvestigation) {
    description =
      "Investigation is continuing. Create escalation will only be available if escalation is later approved.";
  } else if (insufficient) {
    description =
      "Further evidence is needed before escalation can be considered.";
  } else if (record.decision?.decision === "rejected") {
    description =
      "Escalation was not approved, so no escalation package was prepared.";
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-foreground">Create escalation</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>
    </div>
  );
}
