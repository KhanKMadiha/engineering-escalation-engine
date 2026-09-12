import {
  EVIDENCE_SOURCE_FIELD_VALUES,
  type CaseAnalysisResult,
  type EvidenceIdentifiedItem,
  type EvidenceSourceField,
} from "@/lib/analysis/analysis-schema";
import type { SupportCase } from "@/types";

export type RejectedEvidenceItem = EvidenceIdentifiedItem & {
  reason: string;
};

export type EvidenceValidationResult = {
  validatedEvidence: EvidenceIdentifiedItem[];
  rejectedEvidence: RejectedEvidenceItem[];
  warnings: string[];
  evidenceCompletenessScore: number;
};

type CaseEvidenceFields = Pick<SupportCase, EvidenceSourceField>;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function fieldContainsExcerpt(
  fieldValue: string,
  quotedExcerpt: string,
): boolean {
  const excerpt = normalizeWhitespace(quotedExcerpt);
  if (excerpt.length === 0) {
    return false;
  }
  return normalizeWhitespace(fieldValue).includes(excerpt);
}

function getCaseFieldValue(
  caseRecord: CaseEvidenceFields,
  sourceField: EvidenceSourceField,
): string {
  return caseRecord[sourceField] ?? "";
}

function isEvidenceSourceField(value: string): value is EvidenceSourceField {
  return (EVIDENCE_SOURCE_FIELD_VALUES as readonly string[]).includes(value);
}

/**
 * Deterministically verifies AI-identified excerpts against customer-provided text.
 * Does not call OpenAI and never mutates the original case.
 */
export function validateEvidence(
  evidenceIdentified: EvidenceIdentifiedItem[],
  caseRecord: CaseEvidenceFields,
): EvidenceValidationResult {
  const validatedEvidence: EvidenceIdentifiedItem[] = [];
  const rejectedEvidence: RejectedEvidenceItem[] = [];
  const warnings: string[] = [];

  for (const item of evidenceIdentified) {
    if (!item.quotedExcerpt || normalizeWhitespace(item.quotedExcerpt) === "") {
      const rejected = {
        ...item,
        reason: "Empty excerpt cannot be verified against customer-provided text.",
      };
      rejectedEvidence.push(rejected);
      warnings.push(
        `Rejected evidence for ${item.sourceField}: empty quoted excerpt.`,
      );
      continue;
    }

    if (!isEvidenceSourceField(item.sourceField)) {
      const rejected = {
        ...item,
        reason: `Unknown source field "${item.sourceField}".`,
      };
      rejectedEvidence.push(rejected);
      warnings.push(
        `Rejected evidence: source field "${item.sourceField}" is not a customer-provided field.`,
      );
      continue;
    }

    const fieldValue = getCaseFieldValue(caseRecord, item.sourceField);
    if (!fieldContainsExcerpt(fieldValue, item.quotedExcerpt)) {
      const rejected = {
        ...item,
        reason: `Quoted excerpt was not found in customer-provided field "${item.sourceField}".`,
      };
      rejectedEvidence.push(rejected);
      warnings.push(
        `Rejected unverifiable evidence claiming source "${item.sourceField}". The excerpt was not present in the submitted case.`,
      );
      continue;
    }

    validatedEvidence.push({
      description: item.description,
      sourceField: item.sourceField,
      quotedExcerpt: item.quotedExcerpt,
    });
  }

  return {
    validatedEvidence,
    rejectedEvidence,
    warnings,
    evidenceCompletenessScore: computeEvidenceCompletenessScore(
      caseRecord,
      validatedEvidence,
    ),
  };
}

/**
 * Completeness = fraction of non-empty eligible customer fields that have
 * at least one validated evidence excerpt. Deterministic and capped at 1.
 */
export function computeEvidenceCompletenessScore(
  caseRecord: CaseEvidenceFields,
  validatedEvidence: EvidenceIdentifiedItem[],
): number {
  const fieldsWithContent = EVIDENCE_SOURCE_FIELD_VALUES.filter(
    (field) => normalizeWhitespace(getCaseFieldValue(caseRecord, field)).length > 0,
  );

  if (fieldsWithContent.length === 0) {
    return 0;
  }

  const covered = new Set(
    validatedEvidence.map((item) => item.sourceField),
  );
  const coveredWithContent = fieldsWithContent.filter((field) =>
    covered.has(field),
  ).length;

  return Number((coveredWithContent / fieldsWithContent.length).toFixed(4));
}

export function applyEvidenceValidationToAnalysis(
  analysis: CaseAnalysisResult,
  caseRecord: CaseEvidenceFields,
): {
  analysis: CaseAnalysisResult;
  validation: EvidenceValidationResult;
} {
  const validation = validateEvidence(analysis.evidenceIdentified, caseRecord);
  return {
    analysis: {
      ...analysis,
      evidenceIdentified: validation.validatedEvidence,
    },
    validation,
  };
}
