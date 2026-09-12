import { ApiError, apiErrorResponse, jsonError } from "@/lib/api/errors";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/api/request-id";
import { logApiRequest } from "@/lib/api/logging";

const MAX_JSON_BODY_BYTES = 512_000; // 512 KB — case fields are already Zod-capped

export type ApiHandlerContext = {
  request: Request;
  requestId: string;
  params?: Record<string, string>;
};

export function withRequestIdHeaders(
  requestId: string,
  init?: ResponseInit,
): Headers {
  const headers = new Headers(init?.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function jsonOk<T>(
  requestId: string,
  data: T,
  status = 200,
  init?: ResponseInit,
): Response {
  return Response.json(data, {
    status,
    ...init,
    headers: withRequestIdHeaders(requestId, init),
  });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json.",
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > MAX_JSON_BODY_BYTES) {
      throw new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        `Request body must be at most ${MAX_JSON_BODY_BYTES} bytes.`,
      );
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Unable to read request body.");
  }

  if (text.length > MAX_JSON_BODY_BYTES) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      `Request body must be at most ${MAX_JSON_BODY_BYTES} bytes.`,
    );
  }

  if (text.trim() === "") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body is required.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export async function handleApiRequest(
  request: Request,
  route: string,
  handler: (ctx: ApiHandlerContext) => Promise<Response>,
  params?: Record<string, string>,
): Promise<Response> {
  const requestId = resolveRequestId(request);
  const started = Date.now();
  let status = 500;

  try {
    const response = await handler({ request, requestId, params });
    status = response.status;
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      status = error.status;
      return apiErrorResponse(requestId, error);
    }
    status = 500;
    const { logOperationalError } = await import("@/lib/security/safe-log");
    logOperationalError("api", {
      event: "unhandled_error",
      errorName: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
      caseId: params?.id,
    });
    return jsonError(
      requestId,
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
    );
  } finally {
    logApiRequest({
      requestId,
      method: request.method,
      route,
      status,
      durationMs: Date.now() - started,
      caseId: params?.id,
    });
  }
}
