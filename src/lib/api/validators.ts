import { z } from "zod";
import {
  ENVIRONMENT_VALUES,
  SEVERITY_VALUES,
} from "@/lib/cases/case-validators";
import type { CaseStatus, Severity } from "@/types";

export const CASE_STATUS_VALUES = [
  "draft",
  "submitted",
  "analyzing",
  "awaiting_decision",
  "escalated",
  "investigation_continues",
  "closed",
] as const satisfies readonly CaseStatus[];

export const caseIdParamSchema = z.string().uuid("Case ID must be a valid UUID");

export const listCasesQuerySchema = z.object({
  status: z.enum(CASE_STATUS_VALUES).optional(),
  severity: z.enum(SEVERITY_VALUES).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListCasesQuery = {
  status?: CaseStatus;
  severity?: Severity;
  page: number;
  pageSize: number;
};

export function parseListCasesQuery(url: URL): ListCasesQuery {
  const result = listCasesQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    severity: url.searchParams.get("severity") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!result.success) {
    const message =
      result.error.issues[0]?.message ?? "Invalid query parameters.";
    throw Object.assign(new Error(message), {
      name: "ListCasesQueryError",
      issues: result.error.issues,
    });
  }
  return result.data as ListCasesQuery;
}

export { SEVERITY_VALUES, ENVIRONMENT_VALUES };
