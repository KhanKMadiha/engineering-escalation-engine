import "server-only";

import { TechnicalEvidenceService } from "@/lib/evidence/evidence-service";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";
import { getTechnicalEvidenceRepository } from "@/lib/repositories/get-technical-evidence-repository";

let cached: TechnicalEvidenceService | null = null;

export function getEvidenceService(): TechnicalEvidenceService {
  if (!cached) {
    cached = new TechnicalEvidenceService(
      getCaseRepository(),
      getTechnicalEvidenceRepository(),
    );
  }
  return cached;
}

export function resetEvidenceServiceCache(): void {
  cached = null;
}
