/**
 * Phase B technical evidence domain types.
 * Independent of AI analysis / case_analyses.
 */

export const TECHNICAL_EVIDENCE_TYPES = [
  "application_log",
  "datadog_log",
  "datadog_trace",
  "api_response",
  "postman_result",
  "auth_error",
  "screenshot",
  "attachment",
  "other",
] as const;

export type TechnicalEvidenceType = (typeof TECHNICAL_EVIDENCE_TYPES)[number];

export const TECHNICAL_EVIDENCE_SOURCES = [
  "customer",
  "support",
  "imported",
  "demo_fictional",
] as const;

export type TechnicalEvidenceSource =
  (typeof TECHNICAL_EVIDENCE_SOURCES)[number];

export const TECHNICAL_EVIDENCE_VERIFICATIONS = [
  "recorded",
  "support_verified",
  "unverified",
  "rejected",
  "demo_fictional",
] as const;

export type TechnicalEvidenceVerification =
  (typeof TECHNICAL_EVIDENCE_VERIFICATIONS)[number];

export type TechnicalEvidenceAttachment = {
  id: string;
  evidenceId: string;
  storagePath: string;
  fileName: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  widthPx: number | null;
  heightPx: number | null;
  checksumSha256: string | null;
  createdAt: string;
  /** Short-lived signed URL for display — never a permanent public URL. */
  previewUrl?: string | null;
};

export type TechnicalEvidenceRecord = {
  id: string;
  caseId: string;
  evidenceType: TechnicalEvidenceType;
  title: string;
  service: string | null;
  body: string | null;
  caption: string | null;
  capturedAt: string | null;
  requestId: string | null;
  traceId: string | null;
  externalUrl: string | null;
  source: TechnicalEvidenceSource;
  verificationStatus: TechnicalEvidenceVerification;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  attachments: TechnicalEvidenceAttachment[];
};

export type CreateTechnicalEvidenceInput = {
  caseId: string;
  evidenceType: TechnicalEvidenceType;
  title: string;
  service?: string | null;
  body?: string | null;
  caption?: string | null;
  capturedAt?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  externalUrl?: string | null;
  source: TechnicalEvidenceSource;
  verificationStatus?: TechnicalEvidenceVerification;
  sortOrder?: number;
};

export type UpdateTechnicalEvidenceInput = {
  title?: string;
  service?: string | null;
  body?: string | null;
  caption?: string | null;
  capturedAt?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  externalUrl?: string | null;
  source?: TechnicalEvidenceSource;
  verificationStatus?: TechnicalEvidenceVerification;
  sortOrder?: number;
  evidenceType?: TechnicalEvidenceType;
};

export const EVIDENCE_TITLE_BY_TYPE: Record<TechnicalEvidenceType, string> = {
  application_log: "Application logs",
  datadog_log: "Datadog logs",
  datadog_trace: "Datadog trace",
  api_response: "API response",
  postman_result: "Postman API test",
  auth_error: "SSO / auth error",
  screenshot: "Error screenshot",
  attachment: "Technical attachment",
  other: "Technical evidence",
};

export const MAX_EVIDENCE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EVIDENCE_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
