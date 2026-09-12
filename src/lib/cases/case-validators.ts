import { z } from "zod";
import type { CreateCaseInput } from "@/types";

export const SEVERITY_VALUES = ["critical", "high", "medium", "low"] as const;
export const ENVIRONMENT_VALUES = [
  "production",
  "staging",
  "development",
  "unknown",
] as const;

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Optional multiline text — empty/absent becomes "". Rejects non-strings. */
const optionalText = (label: string, max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value !== "string") {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be text`,
        });
        return z.NEVER;
      }
      const trimmed = value.trim();
      if (trimmed.length > max) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be at most ${max} characters`,
        });
        return z.NEVER;
      }
      return trimmed;
    });

export const createCaseInputSchema = z.object({
  customer: requiredText("Customer", 200),
  product: requiredText("Product", 200),
  severity: z.enum(SEVERITY_VALUES, {
    error: "Severity must be critical, high, medium, or low",
  }),
  issueTitle: requiredText("Issue title", 200),
  issueDescription: requiredText("Issue description", 10_000),
  environment: z.enum(ENVIRONMENT_VALUES, {
    error: "Environment must be production, staging, development, or unknown",
  }),
  stepsToReproduce: optionalText("Steps to reproduce", 20_000),
  expectedBehaviour: optionalText("Expected behaviour", 5_000),
  actualBehaviour: optionalText("Actual behaviour", 5_000),
  troubleshootingPerformed: requiredText("Troubleshooting performed", 10_000),
  logsErrors: requiredText("Logs / errors", 50_000),
  requestIds: requiredText("Request IDs", 5_000),
  incidentTimestamp: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      if (value === null || value === undefined) {
        return null;
      }
      const trimmed = value.trim();
      if (trimmed === "") {
        return null;
      }
      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({
          code: "custom",
          message: "Incident timestamp must be a valid date/time",
        });
        return z.NEVER;
      }
      return new Date(parsed).toISOString();
    }),
  /** Approximate timeframe only — never coerced into a datetime. */
  issueFirstObserved: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value !== "string") {
        ctx.addIssue({
          code: "custom",
          message: "Issue first observed must be text",
        });
        return z.NEVER;
      }
      const trimmed = value.trim();
      if (trimmed === "") {
        return null;
      }
      if (trimmed.length > 500) {
        ctx.addIssue({
          code: "custom",
          message: "Issue first observed must be at most 500 characters",
        });
        return z.NEVER;
      }
      return trimmed;
    }),
  affectedCustomerCount: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 1_000_000) {
        ctx.addIssue({
          code: "custom",
          message:
            "Affected customer count must be a whole number between 1 and 1,000,000",
        });
        return z.NEVER;
      }
      return numeric;
    }),
});

export type CreateCaseFormValues = z.infer<typeof createCaseInputSchema>;

export type FieldErrors = Partial<Record<keyof CreateCaseInput, string[]>>;

export type CaseValidationResult =
  | { success: true; data: CreateCaseInput }
  | { success: false; fieldErrors: FieldErrors; formError?: string };

export function validateCreateCaseInput(
  input: unknown,
): CaseValidationResult {
  const result = createCaseInputSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") {
      continue;
    }
    const field = key as keyof CreateCaseInput;
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }

  return {
    success: false,
    fieldErrors,
    formError: "Please correct the highlighted fields.",
  };
}

/** Maps FormData from CaseForm into a plain object for Zod validation. */
export function createCaseInputFromFormData(formData: FormData): unknown {
  return {
    customer: formData.get("customer"),
    product: formData.get("product"),
    severity: formData.get("severity"),
    issueTitle: formData.get("issueTitle"),
    issueDescription: formData.get("issueDescription"),
    environment: formData.get("environment"),
    stepsToReproduce: formData.get("stepsToReproduce"),
    expectedBehaviour: formData.get("expectedBehaviour"),
    actualBehaviour: formData.get("actualBehaviour"),
    troubleshootingPerformed: formData.get("troubleshootingPerformed"),
    logsErrors: formData.get("logsErrors"),
    requestIds: formData.get("requestIds"),
    incidentTimestamp: formData.get("incidentTimestamp"),
    issueFirstObserved: formData.get("issueFirstObserved"),
    affectedCustomerCount: formData.get("affectedCustomerCount"),
  };
}
