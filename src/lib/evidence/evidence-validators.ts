import { z } from "zod";
import {
  ALLOWED_EVIDENCE_IMAGE_TYPES,
  MAX_EVIDENCE_ATTACHMENT_BYTES,
  TECHNICAL_EVIDENCE_SOURCES,
  TECHNICAL_EVIDENCE_TYPES,
  TECHNICAL_EVIDENCE_VERIFICATIONS,
  type CreateTechnicalEvidenceInput,
  type UpdateTechnicalEvidenceInput,
} from "@/lib/evidence/evidence-types";

const optionalText = (max: number) =>
  z
    .union([z.string().max(max), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v == null) {
        return null;
      }
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    });

const createSchema = z.object({
  caseId: z.string().uuid(),
  evidenceType: z.enum(TECHNICAL_EVIDENCE_TYPES),
  title: z.string().trim().min(1).max(200),
  service: optionalText(200),
  body: optionalText(100_000),
  caption: optionalText(500),
  capturedAt: z
    .union([
      z.string().datetime({ offset: true }),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  requestId: optionalText(200),
  traceId: optionalText(200),
  externalUrl: z
    .union([z.string().trim().url().max(2000), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  source: z.enum(TECHNICAL_EVIDENCE_SOURCES),
  verificationStatus: z.enum(TECHNICAL_EVIDENCE_VERIFICATIONS).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const updateSchema = createSchema
  .omit({ caseId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type EvidenceValidationResult<T> =
  | { success: true; data: T }
  | { success: false; formError: string; fieldErrors?: Record<string, string> };

function mapZodError(error: z.ZodError): EvidenceValidationResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return {
    success: false,
    formError: "Please correct the highlighted fields.",
    fieldErrors,
  };
}

export function validateCreateTechnicalEvidence(
  input: unknown,
): EvidenceValidationResult<CreateTechnicalEvidenceInput> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return mapZodError(parsed.error);
  }
  const data = parsed.data;
  return {
    success: true,
    data: {
      caseId: data.caseId,
      evidenceType: data.evidenceType,
      title: data.title,
      service: data.service ?? null,
      body: data.body ?? null,
      caption: data.caption ?? null,
      capturedAt: data.capturedAt ?? null,
      requestId: data.requestId ?? null,
      traceId: data.traceId ?? null,
      externalUrl: data.externalUrl ?? null,
      source: data.source,
      verificationStatus: data.verificationStatus,
      sortOrder: data.sortOrder,
    },
  };
}

export function validateUpdateTechnicalEvidence(
  input: unknown,
): EvidenceValidationResult<UpdateTechnicalEvidenceInput> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return mapZodError(parsed.error);
  }
  return { success: true, data: parsed.data };
}

export function validateEvidenceImageFile(file: {
  type: string;
  size: number;
  name: string;
}): { ok: true } | { ok: false; error: string } {
  if (
    !ALLOWED_EVIDENCE_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_EVIDENCE_IMAGE_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      error: "Only PNG, JPEG, and WebP images are allowed.",
    };
  }
  if (file.size <= 0 || file.size > MAX_EVIDENCE_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: "Image must be between 1 byte and 5 MB.",
    };
  }
  if (!file.name.trim()) {
    return { ok: false, error: "File name is required." };
  }
  return { ok: true };
}

/** Convert datetime-local values to ISO-8601 with offset for zod datetime. */
export function normalizeCapturedAtInput(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  const value = String(raw).trim();
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toISOString();
  }
  return value;
}

export function createEvidenceInputFromFormData(
  formData: FormData,
  caseId: string,
): unknown {
  return {
    caseId,
    evidenceType: String(formData.get("evidenceType") ?? ""),
    title: String(formData.get("title") ?? ""),
    service: String(formData.get("service") ?? ""),
    body: String(formData.get("body") ?? ""),
    caption: String(formData.get("caption") ?? ""),
    capturedAt: normalizeCapturedAtInput(formData.get("capturedAt")),
    requestId: String(formData.get("requestId") ?? ""),
    traceId: String(formData.get("traceId") ?? ""),
    externalUrl: String(formData.get("externalUrl") ?? ""),
    source: String(formData.get("source") ?? "support"),
    verificationStatus: String(
      formData.get("verificationStatus") ?? "recorded",
    ),
  };
}

export function updateEvidenceInputFromFormData(formData: FormData): unknown {
  return {
    evidenceType: String(formData.get("evidenceType") ?? "") || undefined,
    title: String(formData.get("title") ?? "") || undefined,
    service: String(formData.get("service") ?? ""),
    body: String(formData.get("body") ?? ""),
    caption: String(formData.get("caption") ?? ""),
    capturedAt: normalizeCapturedAtInput(formData.get("capturedAt")),
    requestId: String(formData.get("requestId") ?? ""),
    traceId: String(formData.get("traceId") ?? ""),
    externalUrl: String(formData.get("externalUrl") ?? ""),
    source: String(formData.get("source") ?? "") || undefined,
    verificationStatus:
      String(formData.get("verificationStatus") ?? "") || undefined,
  };
}
