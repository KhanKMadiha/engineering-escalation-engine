import {
  EVIDENCE_TITLE_BY_TYPE,
  type TechnicalEvidenceRecord,
  type TechnicalEvidenceSource,
  type TechnicalEvidenceType,
  type TechnicalEvidenceVerification,
} from "@/lib/evidence/evidence-types";

export function evidenceTypeLabel(type: TechnicalEvidenceType): string {
  return EVIDENCE_TITLE_BY_TYPE[type];
}

export function evidenceSourceLabel(source: TechnicalEvidenceSource): string {
  switch (source) {
    case "customer":
      return "Customer-supplied";
    case "support":
      return "Support-captured";
    case "imported":
      return "Imported";
    case "demo_fictional":
      return "Fictional demo evidence";
    default:
      return source;
  }
}

export function evidenceVerificationLabel(
  status: TechnicalEvidenceVerification,
): string {
  switch (status) {
    case "recorded":
      return "Recorded (unverified)";
    case "support_verified":
      return "Support-verified";
    case "unverified":
      return "Unverified";
    case "rejected":
      return "Rejected";
    case "demo_fictional":
      return "Fictional demo";
    default:
      return status;
  }
}

/** Source attribution must not be read as verification by itself. */
export function evidenceProvenanceLines(
  item: TechnicalEvidenceRecord,
): string[] {
  return [
    evidenceSourceLabel(item.source),
    evidenceVerificationLabel(item.verificationStatus),
  ];
}
