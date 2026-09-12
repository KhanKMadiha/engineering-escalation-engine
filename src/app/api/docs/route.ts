import { openApiDocument } from "@/lib/api/openapi";
import { resolveRequestId, REQUEST_ID_HEADER } from "@/lib/api/request-id";

/**
 * Serves the OpenAPI 3.1 document for the Phase 8 REST API.
 * No authentication (documented limitation).
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  return Response.json(openApiDocument, {
    status: 200,
    headers: {
      [REQUEST_ID_HEADER]: requestId,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
