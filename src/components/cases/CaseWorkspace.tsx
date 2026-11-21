"use client";

import { useCallback, useId, useState } from "react";
import type { CaseTabId } from "@/components/cases/CaseWorkspaceTabs";
import { AssessmentTab } from "@/components/cases/tabs/AssessmentTab";
import { HandoffTab } from "@/components/cases/tabs/HandoffTab";
import { InvestigationTab } from "@/components/cases/tabs/InvestigationTab";
import { OverviewTab } from "@/components/cases/tabs/OverviewTab";
import { CaseWorkflowStepper } from "@/components/ui/Stepper";
import {
  workflowStageForStatus,
  type WorkflowStage,
} from "@/lib/ui/case-workflow-stages";
import type { CaseRecord } from "@/types";

type CaseWorkspaceProps = {
  record: CaseRecord;
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
      return "Handoff";
    default:
      return "Case details";
  }
}

/**
 * Case workspace: interactive five-step navigator replaces the tab bar.
 * Initial section follows current case status; changing sections is local UI
 * state only and does not mutate approval/handoff gates or case status.
 */
export function CaseWorkspace({ record }: CaseWorkspaceProps) {
  const [selectedStage, setSelectedStage] = useState<WorkflowStage>(() =>
    // Open at the current relevant workflow stage (e.g. Investigation /
    // Human decision / Handoff). Earlier completed stages remain navigable.
    workflowStageForStatus(record.status),
  );
  const panelId = useId();

  const goToTab = useCallback((tab: CaseTabId) => {
    setSelectedStage(tabToStage(tab));
  }, []);

  const showOverview =
    selectedStage === "Case details" || selectedStage === "Human decision";

  return (
    <div className="space-y-5">
      <CaseWorkflowStepper
        status={record.status}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
        panelId={panelId}
      />

      <div
        id={panelId}
        role="tabpanel"
        aria-label={`${selectedStage} section`}
        className="pt-1"
      >
        {showOverview ? (
          <OverviewTab record={record} goToTab={goToTab} />
        ) : null}
        {selectedStage === "Investigation" ? (
          <InvestigationTab record={record} />
        ) : null}
        {selectedStage === "Assessment" ? (
          <AssessmentTab record={record} />
        ) : null}
        {selectedStage === "Handoff" ? (
          <HandoffTab record={record} />
        ) : null}
      </div>
    </div>
  );
}
