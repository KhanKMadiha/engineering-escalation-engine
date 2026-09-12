import { z } from "zod";
import type { HumanDecisionType } from "@/types";

export const HUMAN_DECISION_VALUES = ["approved", "rejected"] as const;

export const DEFAULT_DECIDED_BY = "support_engineer";

export const submitHumanDecisionSchema = z.object({
  caseId: z
    .string()
    .trim()
    .uuid("Case ID must be a valid UUID"),
  decision: z.enum(HUMAN_DECISION_VALUES, {
    error: "Decision must be approved or rejected",
  }),
  rationale: z
    .string({ error: "Rationale is required" })
    .trim()
    .min(10, "Rationale must be at least 10 characters")
    .max(4000, "Rationale must be at most 4000 characters"),
  decidedBy: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .default(DEFAULT_DECIDED_BY),
});

export type SubmitHumanDecisionInput = z.infer<typeof submitHumanDecisionSchema>;

export type DecisionFieldErrors = Partial<
  Record<"caseId" | "decision" | "rationale" | "decidedBy", string[]>
>;

export type DecisionValidationResult =
  | { success: true; data: SubmitHumanDecisionInput }
  | { success: false; fieldErrors: DecisionFieldErrors; formError: string };

export function validateSubmitHumanDecision(
  input: unknown,
): DecisionValidationResult {
  const result = submitHumanDecisionSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: DecisionFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") {
      continue;
    }
    const field = key as keyof DecisionFieldErrors;
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }

  return {
    success: false,
    fieldErrors,
    formError: "Please correct the decision form.",
  };
}

export function isHumanDecisionType(value: string): value is HumanDecisionType {
  return (HUMAN_DECISION_VALUES as readonly string[]).includes(value);
}
