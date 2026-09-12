"use client";

import {
  useCallback,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

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
 * Accessible Jira-style workflow tablist.
 * Arrow separators are visual only — tabs remain freely navigable.
 * Tab switches are local UI state only — no domain mutations.
 */
export function CaseWorkspaceTabs({
  initialTab = "overview",
  renderPanel,
}: CaseWorkspaceTabsProps) {
  const [active, setActive] = useState<CaseTabId>(initialTab);
  const baseId = useId();

  const goToTab = useCallback((tab: CaseTabId) => {
    setActive(tab);
  }, []);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = CASE_TABS.length - 1;
    let next = index;
    if (event.key === "ArrowRight") {
      next = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      next = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    } else {
      return;
    }
    event.preventDefault();
    const tab = CASE_TABS[next];
    setActive(tab.id);
    const el = document.getElementById(`${baseId}-tab-${tab.id}`);
    el?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Case workflow"
        className="flex flex-wrap items-end border-b border-slate-200"
      >
        {CASE_TABS.map((tab, index) => {
          const selected = active === tab.id;
          return (
            <div key={tab.id} className="flex items-end">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="mb-2.5 select-none px-1.5 text-sm text-slate-300"
                >
                  →
                </span>
              ) : null}
              <button
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`-mb-px border-b-2 px-2.5 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:px-3 ${
                  selected
                    ? "border-sky-600 text-sky-900"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            </div>
          );
        })}
      </div>

      {CASE_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <div
            key={tab.id}
            id={`${baseId}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={!selected}
            className="pt-6"
          >
            {selected ? renderPanel(tab.id, goToTab) : null}
          </div>
        );
      })}
    </div>
  );
}
