import { createCaseEvent } from "@/lib/audit/case-events";
import {
  assertCanCloneDemoTemplate,
  templateHasApprovedHandoff,
} from "@/lib/demo/demo-case-access";
import { isDemoWorkspaceExpired } from "@/lib/demo/demo-workspace";
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
  DemoDownstreamDestination,
  DemoDownstreamRecord,
  DemoWorkspace,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
  SupportCaseSummary,
} from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DemoWorkspaceRow = {
  id: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
};

type DemoDownstreamRow = {
  id: string;
  demo_workspace_id: string;
  case_id: string;
  destination: DemoDownstreamDestination;
  external_reference: string;
  payload: Record<string, unknown>;
  handoff_id: string | null;
  created_at: string;
};

function demoDownstreamFromRow(row: DemoDownstreamRow): DemoDownstreamRecord {
  return {
    id: row.id,
    demoWorkspaceId: row.demo_workspace_id,
    caseId: row.case_id,
    destination: row.destination,
    externalReference: row.external_reference,
    payload: row.payload,
    handoffId: row.handoff_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function demoDownstreamToRow(
  record: DemoDownstreamRecord,
): DemoDownstreamRow {
  return {
    id: record.id,
    demo_workspace_id: record.demoWorkspaceId,
    case_id: record.caseId,
    destination: record.destination,
    external_reference: record.externalReference,
    payload: record.payload,
    handoff_id: record.handoffId,
    created_at: record.createdAt,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function demoWorkspaceFromRow(row: DemoWorkspaceRow): DemoWorkspace {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    lastActiveAt: new Date(row.last_active_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

/**
 * Clone inserts must work without the assessment-versioning migration, so
 * versioning columns are stripped from rows built by the shared mappers.
 */
function withoutVersioning<
  T extends { assessment_version?: unknown; is_current?: unknown },
>(row: T): Omit<T, "assessment_version" | "is_current"> {
  const { assessment_version: _v, is_current: _c, ...rest } = row;
  void _v;
  void _c;
  return rest;
}

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

  async findByExternalTicket(
    sourceSystem: string,
    externalTicketId: string,
  ): Promise<SupportCase | null> {
    const { data, error } = await this.client
      .from("support_cases")
      .select("*")
      .eq("source_system", sourceSystem)
      .eq("external_ticket_id", externalTicketId)
      .maybeSingle();

    if (error) {
      this.logFailure("findByExternalTicket", externalTicketId, error);
      throw mapSupabaseError(error, "findByExternalTicket");
    }
    if (!data) {
      return null;
    }
    return supportCaseFromRow(data as Parameters<typeof supportCaseFromRow>[0]);
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
    const includeTemplates = filters?.includeSharedTemplates !== false;
    const workspaceId =
      filters?.demoWorkspaceId && UUID_PATTERN.test(filters.demoWorkspaceId)
        ? filters.demoWorkspaceId
        : null;

    if (!includeTemplates && !workspaceId) {
      return [];
    }

    const run = async (scopeWorkspaces: boolean) => {
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

      // Shared templates have demo_workspace_id IS NULL; forks are private to
      // their owning workspace. Skipped when the CoW migration is not applied.
      if (scopeWorkspaces) {
        if (includeTemplates && workspaceId) {
          query = query.or(
            `demo_workspace_id.is.null,demo_workspace_id.eq.${workspaceId}`,
          );
        } else if (includeTemplates) {
          query = query.is("demo_workspace_id", null);
        } else if (workspaceId) {
          query = query.eq("demo_workspace_id", workspaceId);
        }
      }

      return query;
    };

    let { data, error } = await run(true);
    // Before 20261122130000 is applied, demo_workspace_id does not exist —
    // treat every row as a shared template (pre–Phase 2A behaviour).
    if (error && (error.code === "42703" || /demo_workspace_id/i.test(error.message))) {
      ({ data, error } = await run(false));
    }
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
    // Strip versioning columns so writes work without
    // 20261122120000_assessment_versions_and_multi_decisions.sql.
    const row = withoutVersioning(analysisToRow(caseId, analysis));
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
    // Strip versioning columns so writes work without
    // 20261122120000_assessment_versions_and_multi_decisions.sql.
    const row = withoutVersioning(escalationResultToRow(caseId, result));
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

  // -------------------------------------------------------------------------
  // Demo workspaces (Phase 2A) — requires 20261122130000 migration
  // -------------------------------------------------------------------------

  async createDemoWorkspace(workspace: DemoWorkspace): Promise<DemoWorkspace> {
    const { data, error } = await this.client
      .from("demo_workspaces")
      .insert({
        id: workspace.id,
        created_at: workspace.createdAt,
        last_active_at: workspace.lastActiveAt,
        expires_at: workspace.expiresAt,
      })
      .select("*")
      .single();

    if (error) {
      this.logFailure("createDemoWorkspace", undefined, error);
      throw mapSupabaseError(error, "createDemoWorkspace");
    }
    return demoWorkspaceFromRow(data as DemoWorkspaceRow);
  }

  async getDemoWorkspace(id: string): Promise<DemoWorkspace | null> {
    if (!UUID_PATTERN.test(id)) {
      return null;
    }
    const { data, error } = await this.client
      .from("demo_workspaces")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      this.logFailure("getDemoWorkspace", undefined, error);
      throw mapSupabaseError(error, "getDemoWorkspace");
    }
    return data ? demoWorkspaceFromRow(data as DemoWorkspaceRow) : null;
  }

  async touchDemoWorkspace(id: string, lastActiveAt: string): Promise<void> {
    const { data, error } = await this.client
      .from("demo_workspaces")
      .update({ last_active_at: lastActiveAt })
      .eq("id", id)
      .select("id");

    if (error) {
      this.logFailure("touchDemoWorkspace", undefined, error);
      throw mapSupabaseError(error, "touchDemoWorkspace");
    }
    if (!data || data.length === 0) {
      throw new RecordNotFoundError("Demo workspace", id);
    }
  }

  async purgeExpiredDemoWorkspaces(nowIso?: string): Promise<number> {
    const { data, error } = await this.client.rpc(
      "purge_expired_demo_workspaces",
      { p_now: nowIso ?? new Date().toISOString() },
    );

    if (error) {
      this.logFailure("purgeExpiredDemoWorkspaces", undefined, error);
      throw mapSupabaseError(error, "purgeExpiredDemoWorkspaces");
    }
    return typeof data === "number" ? data : Number(data ?? 0);
  }

  /**
   * Copy-on-write fork of a shared template into a visitor workspace.
   *
   * - Idempotent per (workspace, template), enforced by a unique index.
   * - Approved templates keep their original decision/handoff provenance
   *   (is_simulated = false); no second approval is recorded.
   * - Versioning columns are intentionally omitted so this works without the
   *   assessment-versioning migration.
   * - Not a single DB transaction; a partially built fork is deleted on error.
   */
  async cloneCaseIntoDemoWorkspace(
    templateCaseId: string,
    workspaceId: string,
  ): Promise<CaseRecord> {
    const workspace = await this.getDemoWorkspace(workspaceId);
    if (!workspace) {
      throw new RecordNotFoundError("Demo workspace", workspaceId);
    }
    if (isDemoWorkspaceExpired(workspace)) {
      throw new PersistenceError(
        "Demo workspace has expired",
        "DEMO_WORKSPACE_EXPIRED",
      );
    }

    const existingForkId = await this.findForkId(workspaceId, templateCaseId);
    if (existingForkId) {
      return this.requireForkRecord(existingForkId);
    }

    const template = await this.getCaseWithDetails(templateCaseId);
    if (!template) {
      throw new RecordNotFoundError("Case", templateCaseId);
    }
    assertCanCloneDemoTemplate(template);

    const now = new Date().toISOString();
    const forkId = crypto.randomUUID();
    const preserveApproval = templateHasApprovedHandoff(template);

    const forkRow: SupportCaseRow = {
      id: forkId,
      customer: template.customer,
      product: template.product,
      severity: template.severity,
      issue_title: template.issueTitle,
      issue_description: template.issueDescription,
      environment: template.environment,
      steps_to_reproduce: template.stepsToReproduce.trim() || null,
      expected_behaviour: template.expectedBehaviour.trim() || null,
      actual_behaviour: template.actualBehaviour.trim() || null,
      troubleshooting_performed: template.troubleshootingPerformed,
      logs_errors: template.logsErrors,
      request_ids: template.requestIds,
      incident_timestamp: template.incidentTimestamp,
      issue_first_observed: template.issueFirstObserved,
      affected_customer_count: template.affectedCustomerCount,
      source_system: template.sourceSystem ?? null,
      external_ticket_id: template.externalTicketId ?? null,
      external_url: template.externalUrl ?? null,
      status: template.status,
      created_at: now,
      updated_at: now,
      demo_workspace_id: workspaceId,
      cloned_from_case_id: templateCaseId,
    };

    const { error: caseError } = await this.client
      .from("support_cases")
      .insert(forkRow);

    if (caseError) {
      if (caseError.code === "23505") {
        // Lost a race with a concurrent clone of the same template.
        const raced = await this.findForkId(workspaceId, templateCaseId);
        if (raced) {
          return this.requireForkRecord(raced);
        }
      }
      this.logFailure("cloneCaseIntoDemoWorkspace", forkId, caseError);
      throw mapSupabaseError(caseError, "cloneCaseIntoDemoWorkspace");
    }

    try {
      await this.copyForkChildren({
        template,
        forkId,
        templateCaseId,
        preserveApproval,
        now,
      });
    } catch (error) {
      // Best-effort cleanup; child rows cascade from support_cases.
      await this.client.from("support_cases").delete().eq("id", forkId);
      throw error;
    }

    return this.requireForkRecord(forkId);
  }

  private async copyForkChildren(input: {
    template: CaseRecord;
    forkId: string;
    templateCaseId: string;
    preserveApproval: boolean;
    now: string;
  }): Promise<void> {
    const { template, forkId, templateCaseId, preserveApproval, now } = input;

    if (template.analysis) {
      const row = withoutVersioning(
        analysisToRow(forkId, { ...template.analysis, id: crypto.randomUUID() }),
      );
      const { error } = await this.client.from("case_analyses").insert(row);
      if (error) {
        this.logFailure("cloneCase.analysis", forkId, error);
        throw mapSupabaseError(error, "cloneCase.analysis");
      }
    }

    if (template.escalationResult) {
      const row = withoutVersioning(
        escalationResultToRow(forkId, template.escalationResult),
      );
      const { error } = await this.client
        .from("escalation_results")
        .insert({ ...row, created_at: now });
      if (error) {
        this.logFailure("cloneCase.escalation", forkId, error);
        throw mapSupabaseError(error, "cloneCase.escalation");
      }
    }

    let copiedDecisionId: string | null = null;
    if (preserveApproval && template.decision) {
      copiedDecisionId = crypto.randomUUID();
      const decisionRow = humanDecisionToRow({
        ...template.decision,
        id: copiedDecisionId,
        caseId: forkId,
        isSimulated: false,
      });
      // Versioning/exception columns exist only after the versioning migration.
      // Keep them only when needed to preserve an exception approval.
      const {
        assessment_version,
        is_exception,
        exception_reason,
        ...baseDecisionRow
      } = decisionRow;
      const insertRow = template.decision.isException
        ? { ...baseDecisionRow, assessment_version, is_exception, exception_reason }
        : baseDecisionRow;

      const { error } = await this.client
        .from("human_decisions")
        .insert(insertRow);
      if (error) {
        this.logFailure("cloneCase.decision", forkId, error);
        throw mapSupabaseError(error, "cloneCase.decision");
      }
    }

    if (preserveApproval && template.handoff) {
      const handoffRow = handoffToRow({
        ...template.handoff,
        id: crypto.randomUUID(),
        caseId: forkId,
        decisionId: copiedDecisionId,
        isSimulated: false,
      });
      const { error } = await this.client
        .from("engineering_handoffs")
        .insert(handoffRow);
      if (error) {
        this.logFailure("cloneCase.handoff", forkId, error);
        throw mapSupabaseError(error, "cloneCase.handoff");
      }
    }

    const cloneEvent = createCaseEvent({
      caseId: forkId,
      eventType: "case_created",
      metadata: {
        clonedFromCaseId: templateCaseId,
        demoWorkspace: true,
        preservedApproval: preserveApproval,
        originalDecisionId: template.decision?.id ?? null,
        originalHandoffId: template.handoff?.id ?? null,
      },
      createdAt: now,
    });
    const { error: eventError } = await this.client
      .from("case_events")
      .insert(caseEventToRow(cloneEvent));
    if (eventError) {
      this.logFailure("cloneCase.event", forkId, eventError);
      throw mapSupabaseError(eventError, "cloneCase.event");
    }

    // Technical evidence metadata only — attachments are never copied.
    const { data: evidenceRows, error: evidenceLoadError } = await this.client
      .from("case_technical_evidence")
      .select("*")
      .eq("case_id", templateCaseId);
    if (evidenceLoadError) {
      this.logFailure("cloneCase.evidence.load", forkId, evidenceLoadError);
      throw mapSupabaseError(evidenceLoadError, "cloneCase.evidence.load");
    }

    const copies = ((evidenceRows ?? []) as Record<string, unknown>[]).map(
      (row) => ({
        ...row,
        id: crypto.randomUUID(),
        case_id: forkId,
        created_at: now,
        updated_at: now,
      }),
    );
    if (copies.length > 0) {
      const { error } = await this.client
        .from("case_technical_evidence")
        .insert(copies);
      if (error) {
        this.logFailure("cloneCase.evidence", forkId, error);
        throw mapSupabaseError(error, "cloneCase.evidence");
      }
    }
  }

  private async findForkId(
    workspaceId: string,
    templateCaseId: string,
  ): Promise<string | null> {
    const { data, error } = await this.client
      .from("support_cases")
      .select("id")
      .eq("demo_workspace_id", workspaceId)
      .eq("cloned_from_case_id", templateCaseId)
      .maybeSingle();

    if (error) {
      this.logFailure("findForkId", templateCaseId, error);
      throw mapSupabaseError(error, "findForkId");
    }
    return data ? (data as { id: string }).id : null;
  }

  private async requireForkRecord(forkId: string): Promise<CaseRecord> {
    const record = await this.getCaseWithDetails(forkId);
    if (!record) {
      throw new RecordNotFoundError("Case", forkId);
    }
    return record;
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

  async saveDemoDownstreamRecord(
    record: DemoDownstreamRecord,
  ): Promise<DemoDownstreamRecord> {
    const { data, error } = await this.client
      .from("demo_downstream_records")
      .insert(demoDownstreamToRow(record))
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const existing = await this.getDemoDownstreamRecord({
          workspaceId: record.demoWorkspaceId,
          caseId: record.caseId,
          destination: record.destination,
        });
        if (existing) {
          return existing;
        }
      }
      this.logFailure("saveDemoDownstreamRecord", record.caseId, error);
      throw mapSupabaseError(error, "saveDemoDownstreamRecord");
    }
    return demoDownstreamFromRow(data as DemoDownstreamRow);
  }

  async getDemoDownstreamRecord(input: {
    workspaceId: string;
    caseId: string;
    destination: DemoDownstreamDestination;
  }): Promise<DemoDownstreamRecord | null> {
    const { data, error } = await this.client
      .from("demo_downstream_records")
      .select("*")
      .eq("demo_workspace_id", input.workspaceId)
      .eq("case_id", input.caseId)
      .eq("destination", input.destination)
      .maybeSingle();

    if (error) {
      this.logFailure("getDemoDownstreamRecord", input.caseId, error);
      throw mapSupabaseError(error, "getDemoDownstreamRecord");
    }
    return data ? demoDownstreamFromRow(data as DemoDownstreamRow) : null;
  }

  async listDemoDownstreamRecordsForCase(input: {
    workspaceId: string;
    caseId: string;
  }): Promise<DemoDownstreamRecord[]> {
    const { data, error } = await this.client
      .from("demo_downstream_records")
      .select("*")
      .eq("demo_workspace_id", input.workspaceId)
      .eq("case_id", input.caseId)
      .order("created_at", { ascending: true });

    if (error) {
      this.logFailure("listDemoDownstreamRecordsForCase", input.caseId, error);
      throw mapSupabaseError(error, "listDemoDownstreamRecordsForCase");
    }
    return ((data as DemoDownstreamRow[] | null) ?? []).map(
      demoDownstreamFromRow,
    );
  }

  async getDemoDownstreamRecordById(
    id: string,
    workspaceId: string,
  ): Promise<DemoDownstreamRecord | null> {
    if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(workspaceId)) {
      return null;
    }
    const { data, error } = await this.client
      .from("demo_downstream_records")
      .select("*")
      .eq("id", id)
      .eq("demo_workspace_id", workspaceId)
      .maybeSingle();

    if (error) {
      this.logFailure("getDemoDownstreamRecordById", undefined, error);
      throw mapSupabaseError(error, "getDemoDownstreamRecordById");
    }
    return data ? demoDownstreamFromRow(data as DemoDownstreamRow) : null;
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
