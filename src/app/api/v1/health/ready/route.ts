import { readinessHandler } from "@/lib/api/handlers/health";
import { handleApiRequest } from "@/lib/api/http";

export async function GET(request: Request): Promise<Response> {
  return handleApiRequest(request, "/api/v1/health/ready", readinessHandler);
}
