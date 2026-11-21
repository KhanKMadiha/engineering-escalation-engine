import { describe, expect, it } from "vitest";
import {
  WORKFLOW_STAGES,
  workflowStageForStatus,
  workflowStageIndex,
} from "@/lib/ui/case-workflow-stages";
import type { CaseStatus } from "@/types";

describe("case workflow stages (presentation only)", () => {
  it("exposes five fixed stages", () => {
    expect(WORKFLOW_STAGES).toEqual([
      "Case details",
      "Investigation",
      "Assessment",
      "Human decision",
      "Handoff",
    ]);
  });

  it.each<[CaseStatus, string, number]>([
    ["draft", "Case details", 0],
    ["submitted", "Case details", 0],
    ["analyzing", "Investigation", 1],
    ["awaiting_decision", "Human decision", 3],
    ["escalated", "Handoff", 4],
    ["investigation_continues", "Investigation", 1],
    ["closed", "Handoff", 4],
  ])("maps %s → %s (index %i) for initial workspace selection", (status, stage, index) => {
    expect(workflowStageForStatus(status)).toBe(stage);
    expect(workflowStageIndex(status)).toBe(index);
  });
});
