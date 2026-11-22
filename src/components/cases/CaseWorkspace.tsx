"use client";

import { useCallback, useId, useState } from "react";
import type { CaseTabId } from "@/components/cases/CaseWorkspaceTabs";
import { ApprovalTab } from "@/components/cases/tabs/ApprovalTab";
import { AssessmentTab } from "@/components/cases/tabs/AssessmentTab";
import { HandoffTab } from "@/components/cases/tabs/HandoffTab";
import { InvestigationTab } from "@/components/cases/tabs/InvestigationTab";
import { OverviewTab } from "@/components/cases/tabs/OverviewTab";
import { CaseWorkflowStepper } from "@/components/ui/Stepper";
import {
  isWorkflowStageAvailable,
  workflowStageForStatus,
  type WorkflowStage,
} from "@/lib/ui/case-workflow-stages";
import type { CaseRecord, DemoDownstreamRecord } from "@/types";

type CaseWorkspaceProps = {
  record: CaseRecord;
  existingDownstreamRecords?: DemoDownstreamRecord[];
};

/**
 * Maps legacy tab ids (used by Overview deep-links) to workflow stages.
 * Presentation only — does not alter domain state.
 */
function tabToStage(tab: CaseTabId): WorkflowStage {
  switch (tab) {
    case "overview":
      return "Case details";
    case "investigation":
      return "Investigation";
    case "assessment":
      return "Assessment";
    case "handoff":
      return "Create escalation";
    default:
      return "Case details";
  }
}

function resolveAvailableStage(
  stage: WorkflowStage,
  record: CaseRecord,
): WorkflowStage {
  const recommendation = record.escalationResult?.recommendation ?? null;
  if (isWorkflowStageAvailable(stage, record.status, recommendation)) {
    return stage;
  }
  return workflowStageForStatus(record.status, recommendation);
}

/**
 * Case workspace: interactive five-step navigator replaces the tab bar.
 * Initial section follows current case status; changing sections is local UI
 * state only and does not mutate approval/handoff gates or case status.
 * Unavailable stages cannot be selected through normal navigation.
 */
export function CaseWorkspace({
  record,
  existingDownstreamRecords = [],
}: CaseWorkspaceProps) {
  const recommendation = record.escalationResult?.recommendation ?? null;
  const [selectedStage, setSelectedStage] = useState<WorkflowStage>(() =>
    resolveAvailableStage(
      workflowStageForStatus(record.status, recommendation),
      record,
    ),
  );
  const panelId = useId();

  const selectStage = useCallback(
    (stage: WorkflowStage) => {
      setSelectedStage(resolveAvailableStage(stage, record));
    },
    [record],
  );

  const goToTab = useCallback(
    (tab: CaseTabId) => {
      selectStage(tabToStage(tab));
    },
    [selectStage],
  );

  const goToStage = useCallback(
    (stage: WorkflowStage) => {
      selectStage(stage);
    },
    [selectStage],
  );

  return (
    <div className="space-y-5">
      <CaseWorkflowStepper
        status={record.status}
        recommendation={recommendation}
        selectedStage={selectedStage}
        onSelectStage={selectStage}
        panelId={panelId}
      />

      <div
        id={panelId}
        role="tabpanel"
        aria-label={`${selectedStage} section`}
        className="pt-1"
      >
        {selectedStage === "Case details" ? (
          <OverviewTab record={record} goToTab={goToTab} />
        ) : null}
        {selectedStage === "Investigation" ? (
          <InvestigationTab record={record} />
        ) : null}
        {selectedStage === "Assessment" ? (
          <AssessmentTab record={record} goToStage={goToStage} />
        ) : null}
        {selectedStage === "Escalation approval" ? (
          <ApprovalTab record={record} goToStage={goToStage} />
        ) : null}
        {selectedStage === "Create escalation" ? (
          <HandoffTab
            record={record}
            existingDownstreamRecords={existingDownstreamRecords}
          />
        ) : null}
      </div>
    </div>
  );
}
