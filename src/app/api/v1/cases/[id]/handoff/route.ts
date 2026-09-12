import { getCaseHandoffHandler } from "@/lib/api/handlers/cases";
import { handleApiRequest } from "@/lib/api/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return handleApiRequest(
    request,
    "/api/v1/cases/:id/handoff",
    getCaseHandoffHandler,
    { id },
  );
}
