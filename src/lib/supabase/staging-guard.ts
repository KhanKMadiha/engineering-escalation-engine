/**
 * Prevents opt-in live Supabase integration / migration tooling from
 * targeting the protected production project.
 */

/** Hosted production project ref — treat as write-protected for Phase 3A+. */
export const PROTECTED_PRODUCTION_SUPABASE_REF = "zfpakilfxnwhlcfjgemw";

export class ProtectedSupabaseTargetError extends Error {
  readonly code = "PROTECTED_SUPABASE_TARGET" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProtectedSupabaseTargetError";
  }
}

export function extractSupabaseProjectRef(
  supabaseUrl: string | null | undefined,
): string | null {
  const raw = supabaseUrl?.trim();
  if (!raw) {
    return null;
  }
  try {
    const host = new URL(raw).hostname;
    const ref = host.split(".")[0]?.trim();
    return ref || null;
  } catch {
    return null;
  }
}

export function assertNotProtectedProductionSupabase(
  supabaseUrl: string | null | undefined,
  options?: { context?: string },
): string {
  const ref = extractSupabaseProjectRef(supabaseUrl);
  if (!ref) {
    throw new ProtectedSupabaseTargetError(
      "SUPABASE_URL is missing or invalid; refusing to continue.",
    );
  }
  if (ref === PROTECTED_PRODUCTION_SUPABASE_REF) {
    const context = options?.context ? ` (${options.context})` : "";
    throw new ProtectedSupabaseTargetError(
      `Refusing to use protected production Supabase project${context}. Configure an isolated staging project instead.`,
    );
  }
  return ref;
}
