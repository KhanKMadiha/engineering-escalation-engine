import { createCaseEvent } from "@/lib/audit/case-events";
import type {
  CaseRepository,
  PersistDecisionOutcomeInput,
} from "@/lib/repositories/case-repository";
import { logOperationalError } from "@/lib/security/safe-log";
import {
  createSupabaseServerClient,
  getSupabaseServerClient,
} from "@/lib/supabase/client";
import {
  DuplicateDecisionError,
  ForeignKeyViolationError,
  PersistenceError,
  RecordNotFoundError,
  mapSupabaseError,
} from "@/lib/supabase/errors";
import {
  analysisToRow,
  assembleCaseRecord,
  caseEventToRpcPayload,
  caseEventToRow,
  decisionToRpcPayload,
  escalationResultToRow,
  handoffToRpcPayload,
  handoffToRow,
  handoffFromRow,
  humanDecisionFromRow,
  humanDecisionToRow,
  supportCaseFromRow,
  supportCaseSummaryFromParts,
  supportCaseToInsert,
  type CaseAnalysisRow,
  type CaseEventRow,
  type EngineeringHandoffRow,
  type EscalationResultRow,
  type HumanDecisionRow,
  type SupportCaseRow,
} from "@/lib/supabase/mappers";
import type {
  CaseEvent,
  CaseListFilters,
  CaseRecord,
  CaseStatus,
  CreateCaseInput,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
  SupportCaseSummary,
} from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase/Postgres CaseRepository.
 * Domain services depend on CaseRepository only — not this class.
 */
export class SupabaseCaseRepository implements CaseRepository {
  constructor(
    private readonly client: SupabaseClient = getSupabaseServerClient(),
  ) {}

  async createCase(input: CreateCaseInput): Promise<SupportCase> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const status: CaseStatus = "draft";
    const row = supportCaseToInsert(id, input, status, now, now);
    const createdEvent = createCaseEvent({
      caseId: id,
      eventType: "case_created",
      metadata: {
        status,
        severity: input.severity,
        environment: input.environment,
        customer: input.customer,
        product: input.product,
      },
      createdAt: now,
    });

    const { error: caseError } = await this.client
      .from("support_cases")
      .insert(row);

    if (caseError) {
      this.logFailure("createCase", id, caseError);
      throw mapSupabaseError(caseError, "createCase");
    }

    const { error: eventError } = await this.client
      .from("case_events")
      .insert(caseEventToRow(createdEvent));

    if (eventError) {
      this.logFailure("createCase.event", id, eventError);
      throw mapSupabaseError(eventError, "createCase.event");
    }

    return supportCaseFromRow(row);
  }

  async getCaseById(id: string): Promise<CaseRecord | null> {
    return this.getCaseWithDetails(id);
  }

  async getCaseWithDetails(id: string): Promise<CaseRecord | null> {
    const { data: caseRow, error: caseError } = await this.client
      .from("support_cases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (caseError) {
      this.logFailure("getCaseWithDetails", id, caseError);
      throw mapSupabaseError(caseError, "getCaseWithDetails");
    }
    if (!caseRow) {
      return null;
    }

    const [
      analysisRes,
      escalationRes,
      decisionRes,
      handoffRes,
      eventsRes,
    ] = await Promise.all([
      this.client
        .from("case_analyses")
        .select("*")
        .eq("case_id", id)
        .maybeSingle(),
      this.client
        .from("escalation_results")
        .select("*")
        .eq("case_id", id)
        .maybeSingle(),
      this.client
        .from("human_decisions")
        .select("*")
        .eq("case_id", id)
        .maybeSingle(),
      this.client
        .from("engineering_handoffs")
        .select("*")
        .eq("case_id", id)
        .maybeSingle(),
      this.client
        .from("case_events")
        .select("*")
        .eq("case_id", id)
        .order("created_at", { ascending: true }),
    ]);

    for (const res of [
      analysisRes,
      escalationRes,
      decisionRes,
      handoffRes,
      eventsRes,
    ]) {
      if (res.error) {
        this.logFailure("getCaseWithDetails.related", id, res.error);
        throw mapSupabaseError(res.error, "getCaseWithDetails.related");
      }
    }

    return assembleCaseRecord({
      caseRow: caseRow as SupportCaseRow,
      analysis: (analysisRes.data as CaseAnalysisRow | null) ?? null,
      escalation: (escalationRes.data as EscalationResultRow | null) ?? null,
      decision: (decisionRes.data as HumanDecisionRow | null) ?? null,
      handoff: (handoffRes.data as EngineeringHandoffRow | null) ?? null,
      events: (eventsRes.data as CaseEventRow[] | null) ?? [],
    });
  }

  async listCases(filters?: CaseListFilters): Promise<SupportCaseSummary[]> {
    let query = this.client
      .from("support_cases")
      .select("*, escalation_results(recommendation, escalation_score)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.severity) {
      query = query.eq("severity", filters.severity);
    }

    const { data, error } = await query;
    if (error) {
      this.logFailure("listCases", undefined, error);
      throw mapSupabaseError(error, "listCases");
    }

    type ListRow = SupportCaseRow & {
      escalation_results:
        | {
            recommendation: EscalationResultRow["recommendation"];
            escalation_score: number;
          }
        | {
            recommendation: EscalationResultRow["recommendation"];
            escalation_score: number;
          }[]
        | null;
    };

    return ((data as ListRow[] | null) ?? []).map((row) => {
      const esc = Array.isArray(row.escalation_results)
        ? row.escalation_results[0]
        : row.escalation_results;
      const { escalation_results: _omit, ...caseRow } = row;
      void _omit;
      return supportCaseSummaryFromParts(caseRow, esc ?? null);
    });
  }

  async updateCaseStatus(id: string, status: CaseStatus): Promise<void> {
    const existing = await this.getSupportCaseRow(id);
    if (!existing) {
      throw new RecordNotFoundError("Case", id);
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();
    const statusEvent = createCaseEvent({
      caseId: id,
      eventType: "status_changed",
      metadata: { from: previousStatus, to: status },
      createdAt: now,
    });

    const { error: updateError } = await this.client
      .from("support_cases")
      .update({ status, updated_at: now })
      .eq("id", id);

    if (updateError) {
      this.logFailure("updateCaseStatus", id, updateError);
      throw mapSupabaseError(updateError, "updateCaseStatus");
    }

    const { error: eventError } = await this.client
      .from("case_events")
      .insert(caseEventToRow(statusEvent));

    if (eventError) {
      this.logFailure("updateCaseStatus.event", id, eventError);
      throw mapSupabaseError(eventError, "updateCaseStatus.event");
    }
  }

  async saveAnalysis(caseId: string, analysis: StoredAnalysis): Promise<void> {
    await this.requireCaseExists(caseId);
    const row = analysisToRow(caseId, analysis);
    const now = new Date().toISOString();

    const { error } = await this.client.from("case_analyses").upsert(row, {
      onConflict: "case_id",
    });

    if (error) {
      this.logFailure("saveAnalysis", caseId, error);
      throw mapSupabaseError(error, "saveAnalysis");
    }

    await this.touchCase(caseId, now);
  }

  async saveEscalationResult(
    caseId: string,
    result: EscalationEngineResult,
  ): Promise<void> {
    await this.requireCaseExists(caseId);
    const row = escalationResultToRow(caseId, result);
    const now = new Date().toISOString();

    const { error } = await this.client.from("escalation_results").upsert(row, {
      onConflict: "case_id",
    });

    if (error) {
      this.logFailure("saveEscalationResult", caseId, error);
      throw mapSupabaseError(error, "saveEscalationResult");
    }

    await this.touchCase(caseId, now);
  }

  async saveHandoff(caseId: string, handoff: EscalationHandoff): Promise<void> {
    return this.saveEngineeringHandoff(caseId, handoff);
  }

  async saveDecision(caseId: string, decision: HumanDecision): Promise<void> {
    return this.saveHumanDecision(caseId, decision);
  }

  async saveEngineeringHandoff(
    caseId: string,
    handoff: EscalationHandoff,
  ): Promise<void> {
    await this.requireCaseExists(caseId);
    const row = handoffToRow(handoff);
    const now = new Date().toISOString();

    const { error } = await this.client
      .from("engineering_handoffs")
      .upsert(row, { onConflict: "case_id" });

    if (error) {
      this.logFailure("saveEngineeringHandoff", caseId, error);
      throw mapSupabaseError(error, "saveEngineeringHandoff");
    }

    await this.touchCase(caseId, now);
  }

  async getEngineeringHandoff(
    caseId: string,
  ): Promise<EscalationHandoff | null> {
    const { data, error } = await this.client
      .from("engineering_handoffs")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    if (error) {
      this.logFailure("getEngineeringHandoff", caseId, error);
      throw mapSupabaseError(error, "getEngineeringHandoff");
    }
    return data ? handoffFromRow(data as EngineeringHandoffRow) : null;
  }

  async saveHumanDecision(
    caseId: string,
    decision: HumanDecision,
  ): Promise<void> {
    await this.requireCaseExists(caseId);
    const row = humanDecisionToRow(decision);
    const now = new Date().toISOString();

    const { error } = await this.client.from("human_decisions").insert(row);

    if (error) {
      this.logFailure("saveHumanDecision", caseId, error);
      if (error.code === "23505") {
        throw new DuplicateDecisionError(caseId);
      }
      throw mapSupabaseError(error, `saveHumanDecision case=${caseId}`);
    }

    await this.touchCase(caseId, now);
  }

  async getHumanDecision(caseId: string): Promise<HumanDecision | null> {
    const { data, error } = await this.client
      .from("human_decisions")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    if (error) {
      this.logFailure("getHumanDecision", caseId, error);
      throw mapSupabaseError(error, "getHumanDecision");
    }
    return data ? humanDecisionFromRow(data as HumanDecisionRow) : null;
  }

  async appendEvent(caseId: string, event: CaseEvent): Promise<void> {
    if (event.caseId !== caseId) {
      throw new PersistenceError(
        `Event caseId (${event.caseId}) does not match target case (${caseId})`,
        "EVENT_CASE_MISMATCH",
      );
    }
    await this.requireCaseExists(caseId);

    const { error } = await this.client
      .from("case_events")
      .insert(caseEventToRow(event));

    if (error) {
      this.logFailure("appendEvent", caseId, error);
      throw mapSupabaseError(error, "appendEvent");
    }

    await this.touchCase(caseId, new Date().toISOString());
  }

  /**
   * Atomically persists human decision (+ optional handoff), status, and audit events.
   */
  async persistDecisionOutcome(
    input: PersistDecisionOutcomeInput,
  ): Promise<void> {
    const { error } = await this.client.rpc("persist_decision_outcome", {
      p_case_id: input.caseId,
      p_decision: decisionToRpcPayload(input.decision),
      p_handoff: input.handoff ? handoffToRpcPayload(input.handoff) : null,
      p_target_status: input.targetStatus,
      p_events: input.events.map(caseEventToRpcPayload),
    });

    if (error) {
      this.logFailure("persistDecisionOutcome", input.caseId, error);
      if (error.code === "23505") {
        throw new DuplicateDecisionError(input.caseId);
      }
      throw mapSupabaseError(
        error,
        `persistDecisionOutcome case=${input.caseId}`,
      );
    }
  }

  async applyDemoSeedTimestamps(
    caseId: string,
    timestamps: {
      createdAt: string;
      updatedAt: string;
      analysisCreatedAt: string | null;
      eventCreatedAts: string[];
      decisionDecidedAt?: string | null;
      handoffCreatedAt?: string | null;
    },
  ): Promise<void> {
    await this.requireCaseExists(caseId);

    const { data: eventRows, error: eventLoadError } = await this.client
      .from("case_events")
      .select("id, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (eventLoadError) {
      this.logFailure("applyDemoSeedTimestamps.events", caseId, eventLoadError);
      throw mapSupabaseError(eventLoadError, "applyDemoSeedTimestamps.events");
    }

    const events = eventRows ?? [];
    if (events.length !== timestamps.eventCreatedAts.length) {
      throw new PersistenceError(
        `Demo timestamp rewrite expected ${events.length} events, got ${timestamps.eventCreatedAts.length}`,
        "DEMO_TIMESTAMP_MISMATCH",
      );
    }

    const { error: caseError } = await this.client
      .from("support_cases")
      .update({
        created_at: timestamps.createdAt,
        updated_at: timestamps.updatedAt,
      })
      .eq("id", caseId);

    if (caseError) {
      this.logFailure("applyDemoSeedTimestamps.case", caseId, caseError);
      throw mapSupabaseError(caseError, "applyDemoSeedTimestamps.case");
    }

    if (timestamps.analysisCreatedAt) {
      const { error: analysisError } = await this.client
        .from("case_analyses")
        .update({ created_at: timestamps.analysisCreatedAt })
        .eq("case_id", caseId);

      if (analysisError) {
        this.logFailure(
          "applyDemoSeedTimestamps.analysis",
          caseId,
          analysisError,
        );
        throw mapSupabaseError(
          analysisError,
          "applyDemoSeedTimestamps.analysis",
        );
      }
    }

    if (timestamps.decisionDecidedAt) {
      const { error: decisionError } = await this.client
        .from("human_decisions")
        .update({ decided_at: timestamps.decisionDecidedAt })
        .eq("case_id", caseId);

      if (decisionError) {
        this.logFailure(
          "applyDemoSeedTimestamps.decision",
          caseId,
          decisionError,
        );
        throw mapSupabaseError(
          decisionError,
          "applyDemoSeedTimestamps.decision",
        );
      }
    }

    if (timestamps.handoffCreatedAt) {
      const { error: handoffError } = await this.client
        .from("engineering_handoffs")
        .update({ created_at: timestamps.handoffCreatedAt })
        .eq("case_id", caseId);

      if (handoffError) {
        this.logFailure(
          "applyDemoSeedTimestamps.handoff",
          caseId,
          handoffError,
        );
        throw mapSupabaseError(handoffError, "applyDemoSeedTimestamps.handoff");
      }
    }

    for (let i = 0; i < events.length; i += 1) {
      const row = events[i] as { id: string };
      const { error: updateEventError } = await this.client
        .from("case_events")
        .update({ created_at: timestamps.eventCreatedAts[i] })
        .eq("id", row.id);

      if (updateEventError) {
        this.logFailure(
          "applyDemoSeedTimestamps.event",
          caseId,
          updateEventError,
        );
        throw mapSupabaseError(
          updateEventError,
          "applyDemoSeedTimestamps.event",
        );
      }
    }
  }

  private async getSupportCaseRow(id: string): Promise<SupportCaseRow | null> {
    const { data, error } = await this.client
      .from("support_cases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      this.logFailure("getSupportCaseRow", id, error);
      throw mapSupabaseError(error, "getSupportCaseRow");
    }
    return (data as SupportCaseRow | null) ?? null;
  }

  private async requireCaseExists(caseId: string): Promise<void> {
    const row = await this.getSupportCaseRow(caseId);
    if (!row) {
      throw new ForeignKeyViolationError(`Case not found: ${caseId}`);
    }
  }

  private async touchCase(caseId: string, updatedAt: string): Promise<void> {
    const { error } = await this.client
      .from("support_cases")
      .update({ updated_at: updatedAt })
      .eq("id", caseId);

    if (error) {
      this.logFailure("touchCase", caseId, error);
      throw mapSupabaseError(error, "touchCase");
    }
  }

  private logFailure(
    operation: string,
    caseId: string | undefined,
    error: { code?: string; message?: string; name?: string },
  ): void {
    logOperationalError("supabase.repository", {
      caseId,
      event: operation,
      errorCode: error.code,
      errorName: error.name ?? "SupabaseError",
      message: error.message?.slice(0, 200),
    });
  }
}

/** Factory used by wiring when Supabase env is configured. */
export function createSupabaseCaseRepository(): SupabaseCaseRepository {
  return new SupabaseCaseRepository(createSupabaseServerClient());
}
