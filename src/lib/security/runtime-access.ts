/**
 * Runtime access helpers.
 *
 * Approach D (Phase 2A): Hosted visitors may mutate only via copy-on-write
 * private forks. Shared templates remain immutable. Generic mutation helpers
 * below still gate local/dev seed and create-case paths; demo decision writes
 * go through `ensureDemoWorkspaceForWrite` + `resolveWritableDemoCase` instead
 * of `assertMutationsAllowed`.
 *
 * - Local runs must not target the production Supabase project.
 */

/** Known production Supabase project ref(s) used by the live demo. */
export const PRODUCTION_SUPABASE_PROJECT_REFS = [
  "zfpakilfxnwhlcfjgemw",
] as const;

export class MutationsDisabledError extends Error {
  readonly code = "MUTATIONS_DISABLED" as const;

  constructor(
    message = "Application mutations are disabled outside verified local development.",
  ) {
    super(message);
    this.name = "MutationsDisabledError";
  }
}

/**
 * Emergency kill-switch for anonymous demo CoW / downstream writes.
 * Queue reads and shared fictional templates remain available.
 */
export class DemoInteractiveWritesDisabledError extends Error {
  readonly code = "DEMO_INTERACTIVE_WRITES_DISABLED" as const;

  constructor(
    message = "Interactive demo writes are temporarily disabled. The case queue and shared templates remain available.",
  ) {
    super(message);
    this.name = "DemoInteractiveWritesDisabledError";
  }
}

export class ProductionDatabaseIsolationError extends Error {
  readonly code = "PRODUCTION_DATABASE_ISOLATION" as const;

  constructor(
    message = "Refusing to use the production Supabase database from a local development runtime.",
  ) {
    super(message);
    this.name = "ProductionDatabaseIsolationError";
  }
}

type Env = NodeJS.ProcessEnv;

/**
 * Hosted/public platforms where the demo must remain read-only.
 * Not bypassable via ALLOW_* environment variables.
 */
export function isHostedPublicRuntime(env: Env = process.env): boolean {
  return Boolean(
    env.VERCEL ||
      env.NETLIFY ||
      env.CF_PAGES ||
      env.RENDER ||
      env.FLY_APP_NAME ||
      env.AWS_EXECUTION_ENV ||
      env.K_SERVICE,
  );
}

/**
 * Verified local development or automated test runtime.
 * Fail-closed: production Node (`next start` without a test runner) is not included.
 */
export function isVerifiedLocalDevelopmentRuntime(
  env: Env = process.env,
): boolean {
  if (isHostedPublicRuntime(env)) {
    return false;
  }

  if (env.VITEST === "true" || env.NODE_ENV === "test") {
    return true;
  }

  return env.NODE_ENV === "development";
}

/** True when Server Actions / write APIs may mutate application state. */
export function canMutateApplicationState(env: Env = process.env): boolean {
  return isVerifiedLocalDevelopmentRuntime(env);
}

export function assertMutationsAllowed(env: Env = process.env): void {
  if (!canMutateApplicationState(env)) {
    throw new MutationsDisabledError();
  }
}

/**
 * Interactive demo writes (workspace create/clone, simulated approvals,
 * simulated Jira/Rootly) are enabled unless explicitly turned off.
 *
 * Set `DEMO_INTERACTIVE_WRITES=0` (or `false` / `off` / `disabled`) on the
 * host to freeze new demo mutations without switching repositories or
 * rotating cookie secrets. Existing cookies and fork rows are left intact;
 * visitors can still browse the shared Case Queue and templates.
 */
export function isDemoInteractiveWritesEnabled(env: Env = process.env): boolean {
  const raw = env.DEMO_INTERACTIVE_WRITES?.trim().toLowerCase();
  if (!raw) {
    return true;
  }
  return !["0", "false", "off", "disabled", "no"].includes(raw);
}

export function assertDemoInteractiveWritesAllowed(
  env: Env = process.env,
): void {
  if (!isDemoInteractiveWritesEnabled(env)) {
    throw new DemoInteractiveWritesDisabledError();
  }
}

export function isProductionSupabaseUrl(
  url: string | null | undefined,
): boolean {
  const trimmed = url?.trim().toLowerCase() ?? "";
  if (!trimmed) {
    return false;
  }
  return PRODUCTION_SUPABASE_PROJECT_REFS.some((ref) =>
    trimmed.includes(ref.toLowerCase()),
  );
}

/**
 * Prevent local development from attaching to the live demo database.
 * Call when selecting or constructing a Supabase-backed repository.
 */
export function assertLocalDatabaseIsolation(env: Env = process.env): void {
  if (!isVerifiedLocalDevelopmentRuntime(env)) {
    return;
  }

  const url = env.SUPABASE_URL?.trim() ?? "";
  if (!url) {
    return;
  }

  if (isProductionSupabaseUrl(url)) {
    throw new ProductionDatabaseIsolationError(
      `Local development cannot use production Supabase (${PRODUCTION_SUPABASE_PROJECT_REFS.join(", ")}). Use CASE_REPOSITORY=memory or a non-production SUPABASE_URL.`,
    );
  }
}

/**
 * Demo seed must never run on hosted public runtimes, even if ALLOW_DEMO_SEED=1.
 */
export function assertDemoSeedRuntimeAllowed(env: Env = process.env): void {
  if (isHostedPublicRuntime(env)) {
    throw new MutationsDisabledError(
      "Demo seed is blocked on hosted/public deployments.",
    );
  }
  assertMutationsAllowed(env);
}
