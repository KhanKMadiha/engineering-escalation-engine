import {
  assertDemoSeedAllowed,
  seedDemoCases,
} from "@/lib/demo/seed-demo-cases";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";
import { resolveRequestId, REQUEST_ID_HEADER } from "@/lib/api/request-id";

/**
 * Explicit demo seed endpoint for local/demo use.
 * Requires ALLOW_DEMO_SEED=1. Blocked when NODE_ENV=production unless that flag is set.
 * Does not auto-approve escalations.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);

  try {
    assertDemoSeedAllowed();
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "DEMO_SEED_FORBIDDEN",
          message:
            error instanceof Error
              ? error.message
              : "Demo seed is not allowed.",
          requestId,
        },
      },
      {
        status: 403,
        headers: { [REQUEST_ID_HEADER]: requestId, "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const result = await seedDemoCases({
      repository: getCaseRepository(),
    });
    return Response.json(
      {
        data: result,
        note: "Demo cases are fictional. Human approval was not recorded.",
        requestId,
      },
      {
        status: 201,
        headers: { [REQUEST_ID_HEADER]: requestId, "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "DEMO_SEED_FAILED",
          message:
            error instanceof Error ? error.message : "Demo seed failed.",
          requestId,
        },
      },
      {
        status: 500,
        headers: { [REQUEST_ID_HEADER]: requestId, "Cache-Control": "no-store" },
      },
    );
  }
}
