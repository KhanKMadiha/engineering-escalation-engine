import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";
import { CaseOrchestrator } from "@/lib/cases/case-orchestrator";
import { CaseService } from "@/lib/cases/case-service";
import { DecisionService } from "@/lib/cases/decision-service";
import { getCaseOrchestrator } from "@/lib/cases/get-case-orchestrator";
import { getCaseService } from "@/lib/cases/get-case-service";
import { getDecisionService } from "@/lib/cases/get-decision-service";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import {
  getCaseRepository,
  resolveCaseRepositoryBackend,
} from "@/lib/repositories/get-case-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Injectable application services for the REST API.
 * Routes must not construct domain logic; they call these services.
 */
export type ApiServices = {
  caseService: CaseService;
  orchestrator: CaseOrchestrator;
  decisionService: DecisionService;
  repository: CaseRepository;
};

export function getDefaultApiServices(
  modelClient?: AnalysisModelClient,
): ApiServices {
  // Lazy orchestrator: read-only handlers never touch OpenAI composition.
  let orchestrator: CaseOrchestrator | undefined;
  return {
    caseService: getCaseService(),
    get orchestrator() {
      return (orchestrator ??= getCaseOrchestrator(modelClient));
    },
    decisionService: getDecisionService(),
    repository: getCaseRepository(),
  };
}

/** Test helper: wire API handlers to an explicit repository + optional model. */
export function createApiServices(options: {
  repository: CaseRepository;
  modelClient?: AnalysisModelClient;
}): ApiServices {
  const caseService = new CaseService(options.repository);
  const decisionService = new DecisionService(options.repository);
  const orchestrator = new CaseOrchestrator(
    options.repository,
    options.modelClient ?? {
      model: "unconfigured",
      async generateAnalysis() {
        throw new Error("Analysis model client not configured for this test");
      },
    },
  );
  return {
    caseService,
    decisionService,
    orchestrator,
    repository: options.repository,
  };
}

export function getPersistenceReadiness(): {
  ready: boolean;
  backend: "memory" | "supabase";
  configured: boolean;
  detail: string;
} {
  const backend = resolveCaseRepositoryBackend();
  if (backend === "memory") {
    return {
      ready: true,
      backend: "memory",
      configured: true,
      detail: "Using in-memory repository",
    };
  }
  const configured = isSupabaseConfigured();
  return {
    ready: configured,
    backend: "supabase",
    configured,
    detail: configured
      ? "Supabase environment configured"
      : "Supabase environment incomplete",
  };
}
