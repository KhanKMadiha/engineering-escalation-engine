import { useCallback, useState, type ReactNode } from "react";

export const CASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "investigation", label: "Investigation" },
  { id: "assessment", label: "Escalation Assessment" },
  { id: "handoff", label: "Handoff" },
] as const;

export type CaseTabId = (typeof CASE_TABS)[number]["id"];

type CaseWorkspaceTabsProps = {
  initialTab?: CaseTabId;
  renderPanel: (tab: CaseTabId, goToTab: (tab: CaseTabId) => void) => ReactNode;
};

/**
 * @deprecated Prefer CaseWorkspace + CaseWorkflowStepper.
 * Kept for CaseTabId / CASE_TABS exports used by Overview deep-links.
 * Tab bar UI removed from Case Detail — do not mount this in product screens.
 */
export function CaseWorkspaceTabs({
  initialTab = "overview",
  renderPanel,
}: CaseWorkspaceTabsProps) {
  const [active, setActive] = useState<CaseTabId>(initialTab);

  const goToTab = useCallback((tab: CaseTabId) => {
    setActive(tab);
  }, []);

  return (
    <div>
      {CASE_TABS.map((tab) => {
        const selected = active === tab.id;
        return selected ? (
          <div key={tab.id}>{renderPanel(tab.id, goToTab)}</div>
        ) : null;
      })}
    </div>
  );
}
