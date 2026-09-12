import { REQUEST_ID_HEADER } from "@/lib/api/request-id";

export type ApiErrorCode =
  | "CASE_NOT_FOUND"
  | "HANDOFF_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_CASE_STATE"
  | "ANALYSIS_IN_PROGRESS"
  | "ANALYSIS_ALREADY_COMPLETED"
  | "DECISION_ALREADY_RECORDED"
  | "DECISION_IN_PROGRESS"
  | "ESCALATION_RESULT_MISSING"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "METHOD_NOT_ALLOWED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "ANALYSIS_FAILED";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonError(
  requestId: string,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {}),
    },
  };
  return Response.json(body, {
    status,
    headers: {
      [REQUEST_ID_HEADER]: requestId,
      "Cache-Control": "no-store",
    },
  });
}

export function apiErrorResponse(requestId: string, error: ApiError): Response {
  return jsonError(
    requestId,
    error.status,
    error.code,
    error.message,
    error.details,
  );
}
