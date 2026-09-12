import { CaseService } from "@/lib/cases/case-service";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";

/**
 * App-wide CaseService wired through the repository composition root.
 */
export function getCaseService(): CaseService {
  return new CaseService(getCaseRepository());
}
