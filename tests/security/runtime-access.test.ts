import { afterEach, describe, expect, it } from "vitest";
import {
  assertDemoInteractiveWritesAllowed,
  assertLocalDatabaseIsolation,
  assertMutationsAllowed,
  canMutateApplicationState,
  DemoInteractiveWritesDisabledError,
  isDemoInteractiveWritesEnabled,
  isHostedPublicRuntime,
  isProductionSupabaseUrl,
  isVerifiedLocalDevelopmentRuntime,
  MutationsDisabledError,
  ProductionDatabaseIsolationError,
  PRODUCTION_SUPABASE_PROJECT_REFS,
} from "@/lib/security/runtime-access";
import {
  resetCaseRepositoryCache,
  resolveCaseRepositoryBackend,
} from "@/lib/repositories/get-case-repository";

describe("runtime access (fail-closed local mutations)", () => {
  afterEach(() => {
    resetCaseRepositoryCache();
  });

  const env = (values: Record<string, string | undefined>): NodeJS.ProcessEnv =>
    values as unknown as NodeJS.ProcessEnv;

  it("treats Vercel and other hosted platforms as public", () => {
    expect(isHostedPublicRuntime(env({ VERCEL: "1" }))).toBe(true);
    expect(isHostedPublicRuntime(env({ NETLIFY: "true" }))).toBe(true);
    expect(isHostedPublicRuntime(env({ NODE_ENV: "development" }))).toBe(false);
  });

  it("allows mutations only in verified local development or test", () => {
    expect(canMutateApplicationState(env({ NODE_ENV: "development" }))).toBe(
      true,
    );
    expect(canMutateApplicationState(env({ NODE_ENV: "test" }))).toBe(true);
    expect(canMutateApplicationState(env({ VITEST: "true" }))).toBe(true);

    expect(canMutateApplicationState(env({ NODE_ENV: "production" }))).toBe(
      false,
    );
    expect(
      canMutateApplicationState(env({ NODE_ENV: "development", VERCEL: "1" })),
    ).toBe(false);
    expect(
      canMutateApplicationState(
        env({
          NODE_ENV: "production",
          ALLOW_MUTATIONS: "1",
          ALLOW_DEMO_SEED: "1",
        }),
      ),
    ).toBe(false);
  });

  it("does not allow hosted writes even when ALLOW_* flags are set", () => {
    expect(() =>
      assertMutationsAllowed(
        env({
          VERCEL: "1",
          ALLOW_DEMO_SEED: "1",
          NODE_ENV: "production",
        }),
      ),
    ).toThrow(MutationsDisabledError);
  });

  it("detects the production Supabase project URL", () => {
    const ref = PRODUCTION_SUPABASE_PROJECT_REFS[0];
    expect(
      isProductionSupabaseUrl(`https://${ref}.supabase.co`),
    ).toBe(true);
    expect(isProductionSupabaseUrl("https://abcd1234.supabase.co")).toBe(false);
  });

  it("blocks local development isolation check for the production Supabase URL", () => {
    const localProd = env({
      NODE_ENV: "development",
      SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
      CASE_REPOSITORY: "supabase",
    });

    expect(() => assertLocalDatabaseIsolation(localProd)).toThrow(
      ProductionDatabaseIsolationError,
    );
    // Repository wiring fails closed to memory instead of attaching to prod.
    expect(resolveCaseRepositoryBackend(localProd)).toBe("memory");
  });

  it("forces memory when local auto-detect would hit production Supabase", () => {
    const backend = resolveCaseRepositoryBackend(
      env({
        NODE_ENV: "development",
        SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
      }),
    );
    expect(backend).toBe("memory");
  });

  it("recognises verified local development", () => {
    expect(
      isVerifiedLocalDevelopmentRuntime(env({ NODE_ENV: "development" })),
    ).toBe(true);
    expect(
      isVerifiedLocalDevelopmentRuntime(env({ NODE_ENV: "production" })),
    ).toBe(false);
  });

  it("enables interactive demo writes by default", () => {
    expect(isDemoInteractiveWritesEnabled(env({}))).toBe(true);
    expect(
      isDemoInteractiveWritesEnabled(env({ DEMO_INTERACTIVE_WRITES: "1" })),
    ).toBe(true);
  });

  it("disables interactive demo writes via explicit kill-switch values", () => {
    for (const value of ["0", "false", "off", "disabled", "no", "FALSE"]) {
      expect(
        isDemoInteractiveWritesEnabled(
          env({ DEMO_INTERACTIVE_WRITES: value }),
        ),
      ).toBe(false);
      expect(() =>
        assertDemoInteractiveWritesAllowed(
          env({ DEMO_INTERACTIVE_WRITES: value }),
        ),
      ).toThrow(DemoInteractiveWritesDisabledError);
    }
  });
});
