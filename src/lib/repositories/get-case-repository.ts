import type { CaseRepository } from "@/lib/repositories/case-repository";
import { getInMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import {
  assertLocalDatabaseIsolation,
  isProductionSupabaseUrl,
  isVerifiedLocalDevelopmentRuntime,
} from "@/lib/security/runtime-access";
import { createSupabaseCaseRepository } from "@/lib/supabase/create-supabase-repository";

export type CaseRepositoryBackend = "memory" | "supabase";

/**
 * Single composition boundary for persistence.
 * Domain services and getters must use this — not scatter env checks.
 *
 * Selection:
 * - CASE_REPOSITORY=memory → always in-memory
 * - CASE_REPOSITORY=supabase → Supabase (requires env; blocked if local→production URL)
 * - unset + Supabase env present → Supabase, except local+production URL → memory
 * - otherwise → in-memory
 *
 * Vitest / local tests default to in-memory (no Supabase env).
 * Supabase clients are only constructed when the supabase backend is selected.
 */
export function resolveCaseRepositoryBackend(
  env: NodeJS.ProcessEnv = process.env,
): CaseRepositoryBackend {
  const explicit = env.CASE_REPOSITORY?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "in-memory") {
    return "memory";
  }

  const supabaseUrl = env.SUPABASE_URL?.trim() ?? "";
  const localAgainstProduction =
    isVerifiedLocalDevelopmentRuntime(env) &&
    isProductionSupabaseUrl(supabaseUrl);

  if (explicit === "supabase") {
    if (localAgainstProduction) {
      // Fail closed for accidental local→production wiring; callers that need
      // an explicit error should call assertLocalDatabaseIsolation().
      return "memory";
    }
    return "supabase";
  }

  const supabaseConfigured = Boolean(
    env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  if (supabaseConfigured && !localAgainstProduction) {
    return "supabase";
  }

  // Local + production URL, or unset config → memory.
  return "memory";
}

const CASE_REPO_CACHE_GLOBAL_KEY = "__eee_case_repository_cache__" as const;

type CaseRepoCacheGlobal = {
  [CASE_REPO_CACHE_GLOBAL_KEY]?: {
    repository: CaseRepository;
    backend: CaseRepositoryBackend;
  };
};

/**
 * Composition root for CaseRepository.
 * Cache is stored on `globalThis` so RSC and Route Handler module graphs
 * resolve to the same repository instance in one Node process.
 */
export function getCaseRepository(): CaseRepository {
  const backend = resolveCaseRepositoryBackend();
  // Defense in depth: never construct a Supabase client against production
  // from a verified local runtime.
  if (backend === "supabase") {
    assertLocalDatabaseIsolation();
  }

  const globalStore = globalThis as unknown as CaseRepoCacheGlobal;  const cached = globalStore[CASE_REPO_CACHE_GLOBAL_KEY];

  if (cached && cached.backend === backend) {
    return cached.repository;
  }

  const repository =
    backend === "supabase"
      ? createSupabaseCaseRepository()
      : getInMemoryCaseRepository();

  globalStore[CASE_REPO_CACHE_GLOBAL_KEY] = { repository, backend };
  return repository;
}

/** Test helper — clears the wiring cache. */
export function resetCaseRepositoryCache(): void {
  delete (globalThis as unknown as CaseRepoCacheGlobal)[CASE_REPO_CACHE_GLOBAL_KEY];
}
