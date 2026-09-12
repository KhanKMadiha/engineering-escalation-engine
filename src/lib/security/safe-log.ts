/**
 * Operational logging helpers.
 * Never log secrets, case bodies, prompts, or API keys.
 */

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]+/g,
  /OPENAI_API_KEY\s*[:=]\s*\S+/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*\S+/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  /Bearer\s+\S+/gi,
];

export function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export type SafeLogContext = {
  caseId?: string;
  event?: string;
  errorCode?: string;
  errorName?: string;
  message?: string;
};

/** Structured operational log — case IDs and failure categories only. */
export function logOperationalError(
  scope: string,
  context: SafeLogContext,
): void {
  const safeMessage = context.message
    ? redactSecrets(context.message).slice(0, 300)
    : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      scope,
      caseId: context.caseId,
      event: context.event,
      errorCode: context.errorCode,
      errorName: context.errorName,
      message: safeMessage,
      at: new Date().toISOString(),
    }),
  );
}
