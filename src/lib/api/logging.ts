import { redactSecrets } from "@/lib/security/safe-log";

export type ApiLogContext = {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  caseId?: string;
};

/** Safe API access log — no bodies, secrets, or prompts. */
export function logApiRequest(context: ApiLogContext): void {
  console.info(
    JSON.stringify({
      level: "info",
      scope: "api",
      requestId: context.requestId,
      method: context.method,
      route: context.route,
      status: context.status,
      durationMs: context.durationMs,
      caseId: context.caseId,
      at: new Date().toISOString(),
    }),
  );
}

export function safeApiErrorMessage(message: string): string {
  return redactSecrets(message).slice(0, 300);
}
