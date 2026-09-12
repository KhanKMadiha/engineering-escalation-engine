import { ApiError, jsonError, type ApiErrorCode } from "@/lib/api/errors";
import type { ApiHandlerContext } from "@/lib/api/http";
import { jsonOk, parseJsonBody } from "@/lib/api/http";
import { safeApiErrorMessage } from "@/lib/api/logging";
import {
  toAnalysisActionResponse,
  toCaseDetailResponse,
  toCaseResponse,
  toCaseSummaryResponse,
  toDecisionActionResponse,
  toEventResponse,
  toHandoffResponse,
} from "@/lib/api/serializers";
import type { ApiServices } from "@/lib/api/services";
import { getDefaultApiServices } from "@/lib/api/services";
import { caseIdParamSchema, parseListCasesQuery } from "@/lib/api/validators";
import { CaseNotFoundError } from "@/lib/cases/case-service";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";
import {
  DecisionAlreadyRecordedError,
  DecisionNotEligibleError,
  MissingEscalationResultError,
} from "@/lib/cases/decision-service";
import { validateSubmitHumanDecision } from "@/lib/cases/decision-validators";
import { DecisionInProgressError } from "@/lib/security/request-guards";

function resolveServices(services?: ApiServices): ApiServices {
  return services ?? getDefaultApiServices();
}

function parseCaseId(raw: string | undefined): string {
  const result = caseIdParamSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid case ID.",
    );
  }
  return result.data;
}

function mappedError(
  requestId: string,
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return jsonError(requestId, status, code, message);
}

export async function createCaseHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const body = await parseJsonBody(ctx.request);
  const validation = validateCreateCaseInput(body);
  if (!validation.success) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      validation.formError ?? "Invalid case payload.",
      { fieldErrors: validation.fieldErrors },
    );
  }

  const created = await resolveServices(services).caseService.createCase(
    validation.data,
  );
  return jsonOk(ctx.requestId, { data: toCaseResponse(created) }, 201);
}

export async function listCasesHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const url = new URL(ctx.request.url);
  let query;
  try {
    query = parseListCasesQuery(url);
  } catch (error) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Invalid query parameters.",
    );
  }

  const pageResult = await resolveServices(services).caseService.listCasesPage({
    status: query.status,
    severity: query.severity,
    page: query.page,
    pageSize: query.pageSize,
  });

  return jsonOk(ctx.requestId, {
    data: pageResult.items.map(toCaseSummaryResponse),
    pagination: {
      page: pageResult.page,
      pageSize: pageResult.pageSize,
      total: pageResult.total,
      hasNextPage: pageResult.page * pageResult.pageSize < pageResult.total,
    },
  });
}

export async function getCaseHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const caseId = parseCaseId(ctx.params?.id);
  try {
    const record =
      await resolveServices(services).caseService.getCaseById(caseId);
    return jsonOk(ctx.requestId, { data: toCaseDetailResponse(record) });
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      throw new ApiError(404, "CASE_NOT_FOUND", "Case not found.");
    }
    throw error;
  }
}

export async function analyzeCaseHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const caseId = parseCaseId(ctx.params?.id);
  const result =
    await resolveServices(services).orchestrator.runAnalysisPipeline(caseId);

  if (result.ok) {
    return jsonOk(ctx.requestId, {
      data: toAnalysisActionResponse({
        caseId: result.caseId,
        record: result.record,
        analysisId: result.analysis.id,
        escalationResult: result.escalationResult,
      }),
    });
  }

  switch (result.errorCode) {
    case "not_found":
      return mappedError(ctx.requestId, 404, "CASE_NOT_FOUND", result.message);
    case "analysis_in_progress":
      return mappedError(
        ctx.requestId,
        409,
        "ANALYSIS_IN_PROGRESS",
        result.message,
      );
    case "already_completed":
      return mappedError(
        ctx.requestId,
        409,
        "ANALYSIS_ALREADY_COMPLETED",
        result.message,
      );
    case "not_eligible":
      return mappedError(
        ctx.requestId,
        409,
        "INVALID_CASE_STATE",
        result.message,
      );
    case "schema_invalid":
    case "provider_error":
    case "escalation_failed":
      return mappedError(
        ctx.requestId,
        502,
        "ANALYSIS_FAILED",
        safeApiErrorMessage(result.message),
      );
    default:
      return mappedError(
        ctx.requestId,
        500,
        "INTERNAL_ERROR",
        "Analysis pipeline failed.",
      );
  }
}

export async function recordDecisionHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const caseId = parseCaseId(ctx.params?.id);
  const body = await parseJsonBody(ctx.request);
  const validation = validateSubmitHumanDecision({
    ...(typeof body === "object" && body !== null ? body : {}),
    caseId,
  });

  if (!validation.success) {
    throw new ApiError(422, "VALIDATION_ERROR", validation.formError, {
      fieldErrors: validation.fieldErrors,
    });
  }

  try {
    const result = await resolveServices(
      services,
    ).decisionService.recordDecision({
      caseId: validation.data.caseId,
      decision: validation.data.decision,
      rationale: validation.data.rationale,
      decidedBy: validation.data.decidedBy,
    });
    return jsonOk(ctx.requestId, {
      data: toDecisionActionResponse(result),
    });
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      throw new ApiError(404, "CASE_NOT_FOUND", "Case not found.");
    }
    if (error instanceof DecisionAlreadyRecordedError) {
      throw new ApiError(409, "DECISION_ALREADY_RECORDED", error.message);
    }
    if (error instanceof DecisionInProgressError) {
      throw new ApiError(409, "DECISION_IN_PROGRESS", error.message);
    }
    if (error instanceof MissingEscalationResultError) {
      throw new ApiError(409, "ESCALATION_RESULT_MISSING", error.message);
    }
    if (error instanceof DecisionNotEligibleError) {
      throw new ApiError(409, "INVALID_CASE_STATE", error.message);
    }
    throw error;
  }
}

export async function listCaseEventsHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const caseId = parseCaseId(ctx.params?.id);
  try {
    const record =
      await resolveServices(services).caseService.getCaseById(caseId);
    const chronological = [...record.events].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    return jsonOk(ctx.requestId, {
      data: chronological.map(toEventResponse),
      order: "chronological",
    });
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      throw new ApiError(404, "CASE_NOT_FOUND", "Case not found.");
    }
    throw error;
  }
}

export async function getCaseHandoffHandler(
  ctx: ApiHandlerContext,
  services?: ApiServices,
): Promise<Response> {
  const caseId = parseCaseId(ctx.params?.id);
  const servicesResolved = resolveServices(services);

  const exists = await servicesResolved.caseService.getCaseOrNull(caseId);
  if (!exists) {
    throw new ApiError(404, "CASE_NOT_FOUND", "Case not found.");
  }

  const handoff =
    await servicesResolved.repository.getEngineeringHandoff(caseId);
  if (!handoff) {
    throw new ApiError(
      404,
      "HANDOFF_NOT_FOUND",
      "Engineering handoff not found.",
    );
  }

  return jsonOk(ctx.requestId, { data: toHandoffResponse(handoff) });
}
