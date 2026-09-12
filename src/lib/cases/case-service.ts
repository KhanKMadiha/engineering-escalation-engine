import {
  assertValidTransition,
} from "@/lib/cases/status-machine";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type {
  CaseListFilters,
  CaseRecord,
  CaseStatus,
  CreateCaseInput,
  SupportCase,
  SupportCaseSummary,
} from "@/types";

export class CaseNotFoundError extends Error {
  constructor(caseId: string) {
    super(`Case not found: ${caseId}`);
    this.name = "CaseNotFoundError";
  }
}

/**
 * Domain service for support case lifecycle operations.
 * Depends on CaseRepository — never on a concrete store.
 */
export class CaseService {
  constructor(private readonly repository: CaseRepository) {}

  async createCase(input: CreateCaseInput): Promise<SupportCase> {
    return this.repository.createCase({
      ...input,
    });
  }

  async getCaseById(id: string): Promise<CaseRecord> {
    const record = await this.repository.getCaseWithDetails(id);
    if (!record) {
      throw new CaseNotFoundError(id);
    }
    return record;
  }

  async getCaseOrNull(id: string): Promise<CaseRecord | null> {
    return this.repository.getCaseWithDetails(id);
  }

  async listCases(filters?: CaseListFilters): Promise<SupportCaseSummary[]> {
    return this.repository.listCases(filters);
  }

  /**
   * Application-layer pagination over listCases.
   * Suitable for current volumes; not a DB-level cursor API.
   */
  async listCasesPage(options?: {
    status?: CaseListFilters["status"];
    severity?: CaseListFilters["severity"];
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: SupportCaseSummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 25;
    const items = await this.repository.listCases({
      status: options?.status,
      severity: options?.severity,
    });
    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }

  async transitionStatus(id: string, to: CaseStatus): Promise<CaseRecord> {
    const current = await this.getCaseById(id);
    assertValidTransition(current.status, to);
    await this.repository.updateCaseStatus(id, to);
    return this.getCaseById(id);
  }
}
