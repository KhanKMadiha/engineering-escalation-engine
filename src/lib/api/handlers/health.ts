import type { ApiHandlerContext } from "@/lib/api/http";
import { jsonOk } from "@/lib/api/http";
import { getPersistenceReadiness } from "@/lib/api/services";

export async function healthHandler(ctx: ApiHandlerContext): Promise<Response> {
  return jsonOk(ctx.requestId, {
    status: "ok",
    service: "engineering-escalation-engine",
    version: "v1",
  });
}

export async function readinessHandler(
  ctx: ApiHandlerContext,
): Promise<Response> {
  const readiness = getPersistenceReadiness();
  if (!readiness.ready) {
    return Response.json(
      {
        status: "not_ready",
        persistence: {
          backend: readiness.backend,
          configured: readiness.configured,
        },
        requestId: ctx.requestId,
      },
      {
        status: 503,
        headers: {
          "x-request-id": ctx.requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return jsonOk(ctx.requestId, {
    status: "ready",
    persistence: {
      backend: readiness.backend,
      configured: readiness.configured,
    },
  });
}
