import { DecisionService } from "@/lib/cases/decision-service";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";

export function getDecisionService(): DecisionService {
  return new DecisionService(getCaseRepository());
}
