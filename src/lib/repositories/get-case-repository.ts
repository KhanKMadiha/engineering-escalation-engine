import type { CaseRepository } from "@/lib/repositories/case-repository";
import { getInMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseCaseRepository } from "@/lib/supabase/create-supabase-repository";

export type CaseRepositoryBackend = "memory" | "supabase";

/**
 * Single composition boundary for persistence.
 * Domain services and getters must use this — not scatter env checks.
 *
 * Selection:
 * - CASE_REPOSITORY=memory → always in-memory
 * - CASE_REPOSITORY=supabase → Supabase (requires env)
 * - unset + Supabase env present → Supabase
 * - otherwise → in-memory
 *
 * Vitest / local tests default to in-memory (no Supabase env).
 * Supabase clients are only constructed when the supabase backend is selected.
 */
export function resolveCaseRepositoryBackend(): CaseRepositoryBackend {
  const explicit = process.env.CASE_REPOSITORY?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "in-memory") {
    return "memory";
  }
  if (explicit === "supabase") {
    return "supabase";
  }
  if (isSupabaseConfigured()) {
    return "supabase";
  }
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
  const globalStore = globalThis as unknown as CaseRepoCacheGlobal;
  const cached = globalStore[CASE_REPO_CACHE_GLOBAL_KEY];

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
