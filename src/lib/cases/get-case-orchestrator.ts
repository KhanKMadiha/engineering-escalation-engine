import { CaseOrchestrator } from "@/lib/cases/case-orchestrator";
import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";
import { createOpenAIAnalysisModelClient } from "@/lib/openai/client";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";

export function getCaseOrchestrator(
  modelClient?: AnalysisModelClient,
): CaseOrchestrator {
  return new CaseOrchestrator(
    getCaseRepository(),
    modelClient ?? createOpenAIAnalysisModelClient(),
  );
}
