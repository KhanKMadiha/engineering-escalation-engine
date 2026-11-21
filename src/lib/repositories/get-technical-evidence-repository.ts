import { resolveCaseRepositoryBackend } from "@/lib/repositories/get-case-repository";
import {
  getInMemoryTechnicalEvidenceRepository,
  type InMemoryTechnicalEvidenceRepository,
} from "@/lib/repositories/in-memory-technical-evidence-repository";
import type { TechnicalEvidenceRepository } from "@/lib/repositories/technical-evidence-repository";
import { createSupabaseTechnicalEvidenceRepository } from "@/lib/supabase/supabase-technical-evidence-repository";

const EVIDENCE_REPO_CACHE_GLOBAL_KEY =
  "__eee_technical_evidence_repository_cache__" as const;

type EvidenceRepoCacheGlobal = {
  [EVIDENCE_REPO_CACHE_GLOBAL_KEY]?: {
    repository: TechnicalEvidenceRepository;
    backend: ReturnType<typeof resolveCaseRepositoryBackend>;
  };
};

/**
 * Composition root for TechnicalEvidenceRepository.
 * Aligns with case repository backend (memory vs supabase).
 */
export function getTechnicalEvidenceRepository(): TechnicalEvidenceRepository {
  const backend = resolveCaseRepositoryBackend();
  const globalStore = globalThis as unknown as EvidenceRepoCacheGlobal;
  const cached = globalStore[EVIDENCE_REPO_CACHE_GLOBAL_KEY];
  if (cached && cached.backend === backend) {
    return cached.repository;
  }
  const repository =
    backend === "supabase"
      ? createSupabaseTechnicalEvidenceRepository()
      : getInMemoryTechnicalEvidenceRepository();
  globalStore[EVIDENCE_REPO_CACHE_GLOBAL_KEY] = { repository, backend };
  return repository;
}

export function resetTechnicalEvidenceRepositoryCache(): void {
  delete (globalThis as unknown as EvidenceRepoCacheGlobal)[
    EVIDENCE_REPO_CACHE_GLOBAL_KEY
  ];
}

export function getInMemoryEvidenceRepoForTests(): InMemoryTechnicalEvidenceRepository {
  return getInMemoryTechnicalEvidenceRepository();
}
