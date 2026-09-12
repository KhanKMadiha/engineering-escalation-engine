"use client";

import {
  CaseWorkspaceTabs,
  type CaseTabId,
} from "@/components/cases/CaseWorkspaceTabs";
import { AssessmentTab } from "@/components/cases/tabs/AssessmentTab";
import { HandoffTab } from "@/components/cases/tabs/HandoffTab";
import { InvestigationTab } from "@/components/cases/tabs/InvestigationTab";
import { OverviewTab } from "@/components/cases/tabs/OverviewTab";
import type { CaseRecord } from "@/types";

type CaseWorkspaceProps = {
  record: CaseRecord;
};

/**
 * Tabbed case workspace. Tab changes are local UI state only.
 */
export function CaseWorkspace({ record }: CaseWorkspaceProps) {
  return (
    <CaseWorkspaceTabs
      renderPanel={(tab: CaseTabId, goToTab) => {
        switch (tab) {
          case "overview":
            return <OverviewTab record={record} goToTab={goToTab} />;
          case "investigation":
            return <InvestigationTab record={record} />;
          case "assessment":
            return <AssessmentTab record={record} />;
          case "handoff":
            return <HandoffTab record={record} />;
          default:
            return null;
        }
      }}
    />
  );
}
