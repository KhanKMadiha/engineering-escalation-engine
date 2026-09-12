import {
  parseCaseAnalysisResult,
  type CaseAnalysisResult,
} from "@/lib/analysis/analysis-schema";
import {
  applyEvidenceValidationToAnalysis,
  type EvidenceValidationResult,
} from "@/lib/analysis/evidence-validator";
import {
  ANALYSIS_PROMPT_VERSION,
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  type AnalysisCasePayload,
} from "@/lib/analysis/prompts";
import type { ProvenanceSource } from "@/lib/provenance/types";
import type { SupportCase } from "@/types";

export type AnalysisModelRequest = {
  systemPrompt: string;
  userPrompt: string;
};

/**
 * Abstraction over the LLM provider so tests can inject a mock
 * without calling OpenAI.
 */
export type AnalysisModelClient = {
  model: string;
  generateAnalysis(request: AnalysisModelRequest): Promise<unknown>;
};

export class AnalysisSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisSchemaError";
  }
}

export class AnalysisProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisProviderError";
  }
}

export type NormalizedCaseAnalysis = {
  id: string;
  result: CaseAnalysisResult;
  evidenceValidation: EvidenceValidationResult;
  provenance: Record<string, ProvenanceSource>;
  model: string;
  promptVersion: string;
  createdAt: string;
};

function toAnalysisPayload(caseRecord: SupportCase): AnalysisCasePayload {
  return {
    id: caseRecord.id,
    customer: caseRecord.customer,
    product: caseRecord.product,
    severity: caseRecord.severity,
    issueTitle: caseRecord.issueTitle,
    issueDescription: caseRecord.issueDescription,
    environment: caseRecord.environment,
    stepsToReproduce: caseRecord.stepsToReproduce,
    expectedBehaviour: caseRecord.expectedBehaviour,
    actualBehaviour: caseRecord.actualBehaviour,
    troubleshootingPerformed: caseRecord.troubleshootingPerformed,
    logsErrors: caseRecord.logsErrors,
    requestIds: caseRecord.requestIds,
    incidentTimestamp: caseRecord.incidentTimestamp,
    issueFirstObserved: caseRecord.issueFirstObserved,
    affectedCustomerCount: caseRecord.affectedCustomerCount,
  };
}

const ANALYSIS_PROVENANCE: Record<string, ProvenanceSource> = {
  assessedSeverity: "ai_inference",
  issueCategory: "ai_inference",
  reproducibility: "ai_inference",
  suspectedProductDefect: "ai_inference",
  reasoning: "ai_inference",
  missingEvidence: "ai_inference",
  recommendedNextSteps: "ai_inference",
  suspectedRootCause: "ai_inference",
  aiEscalationAssessment: "ai_inference",
  evidenceIdentified: "extracted_evidence",
};

/**
 * Runs AI case analysis and evidence validation.
 * Does not escalate, approve, or invoke the Escalation Engine.
 */
export class AIAnalysisService {
  constructor(private readonly modelClient: AnalysisModelClient) {}

  async analyzeCase(caseRecord: SupportCase): Promise<NormalizedCaseAnalysis> {
    const payload = toAnalysisPayload(caseRecord);
    const userPrompt = buildAnalysisUserPrompt(payload);

    let raw: unknown;
    try {
      raw = await this.modelClient.generateAnalysis({
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error";
      throw new AnalysisProviderError(message);
    }

    const parsed = parseCaseAnalysisResult(raw);
    if (!parsed.success) {
      throw new AnalysisSchemaError(
        "AI response failed structured schema validation",
      );
    }

    const { analysis, validation } = applyEvidenceValidationToAnalysis(
      parsed.data,
      caseRecord,
    );

    return {
      id: crypto.randomUUID(),
      result: analysis,
      evidenceValidation: validation,
      provenance: ANALYSIS_PROVENANCE,
      model: this.modelClient.model,
      promptVersion: ANALYSIS_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
    };
  }
}
