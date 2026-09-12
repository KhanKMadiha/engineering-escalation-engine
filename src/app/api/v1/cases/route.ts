import { createCaseHandler, listCasesHandler } from "@/lib/api/handlers/cases";
import { handleApiRequest } from "@/lib/api/http";

export async function GET(request: Request): Promise<Response> {
  return handleApiRequest(request, "/api/v1/cases", listCasesHandler);
}

export async function POST(request: Request): Promise<Response> {
  return handleApiRequest(request, "/api/v1/cases", createCaseHandler);
}
