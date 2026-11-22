import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseWorkflowStepper } from "@/components/ui/Stepper";
import {
  WORKFLOW_STAGES,
  isWorkflowStageAvailable,
  workflowStageForStatus,
  workflowStageIndex,
  workflowStageUnavailableReason,
} from "@/lib/ui/case-workflow-stages";
import type { CaseStatus } from "@/types";

describe("case workflow stages (presentation only)", () => {
  it("exposes five fixed stages", () => {
    expect(WORKFLOW_STAGES).toEqual([
      "Case details",
      "Investigation",
      "Assessment",
      "Escalation approval",
      "Create escalation",
    ]);
  });

  it.each<[CaseStatus, string, number]>([
    ["draft", "Case details", 0],
    ["submitted", "Case details", 0],
    ["analyzing", "Investigation", 1],
    ["awaiting_decision", "Escalation approval", 3],
    ["escalated", "Create escalation", 4],
    ["investigation_continues", "Investigation", 1],
    ["closed", "Create escalation", 4],
  ])("maps %s → %s (index %i) for initial workspace selection", (status, stage, index) => {
    expect(workflowStageForStatus(status)).toBe(stage);
    expect(workflowStageIndex(status)).toBe(index);
  });

  it("maps legacy awaiting_decision + insufficient_evidence to Investigation", () => {
    expect(
      workflowStageForStatus("awaiting_decision", "insufficient_evidence"),
    ).toBe("Investigation");
    expect(
      isWorkflowStageAvailable(
        "Escalation approval",
        "awaiting_decision",
        "insufficient_evidence",
      ),
    ).toBe(false);
  });

  it("Phase 1: disables approval and create stages while investigation continues", () => {
    expect(isWorkflowStageAvailable("Case details", "investigation_continues")).toBe(
      true,
    );
    expect(isWorkflowStageAvailable("Investigation", "investigation_continues")).toBe(
      true,
    );
    expect(isWorkflowStageAvailable("Assessment", "investigation_continues")).toBe(
      true,
    );
    expect(
      isWorkflowStageAvailable("Escalation approval", "investigation_continues"),
    ).toBe(false);
    expect(
      isWorkflowStageAvailable("Create escalation", "investigation_continues"),
    ).toBe(false);
    expect(
      workflowStageUnavailableReason(
        "Escalation approval",
        "investigation_continues",
      ),
    ).toMatch(/not required/i);
  });

  it("Phase 1: escalate-ready cases enable approval but not create until approved", () => {
    expect(
      isWorkflowStageAvailable("Escalation approval", "awaiting_decision", "escalate"),
    ).toBe(true);
    expect(
      isWorkflowStageAvailable("Create escalation", "awaiting_decision", "escalate"),
    ).toBe(false);
    expect(isWorkflowStageAvailable("Escalation approval", "escalated")).toBe(
      true,
    );
    expect(isWorkflowStageAvailable("Create escalation", "escalated")).toBe(true);
  });

  it("renders unavailable stages as disabled in the stepper", () => {
    const html = renderToStaticMarkup(
      <CaseWorkflowStepper
        status="investigation_continues"
        recommendation="insufficient_evidence"
        selectedStage="Investigation"
        onSelectStage={() => undefined}
      />,
    );
    expect(html).toContain("Escalation approval");
    expect(html).toContain("Create escalation");
    expect(html).toContain("aria-disabled=\"true\"");
    expect(html).toContain("disabled");
    expect(html).toContain("not required while investigation continues");
  });
});
