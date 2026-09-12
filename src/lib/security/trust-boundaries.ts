/**
 * Trust boundaries for the Engineering Escalation Engine.
 *
 * - OPENAI_API_KEY is server-only (see src/lib/openai/client.ts + server-only).
 * - SUPABASE_SERVICE_ROLE_KEY is server-only (see src/lib/supabase/client.ts).
 * - Customer case content is untrusted DATA, never application instructions.
 * - AI output is untrusted until schema + evidence validation succeed.
 * - AI output must never set escalation score, recommendation, or status.
 * - Only DecisionService may transition a case to `escalated`.
 * - Domain logic must not import Supabase; persistence stays behind CaseRepository.
 */

export const TRUST_BOUNDARIES = {
  customerContent: "untrusted_data",
  aiOutput: "untrusted_until_validated",
  escalationAuthority: "deterministic_engine",
  escalationStatusAuthority: "human_decision_only",
  secrets: "server_only",
  persistence: "repository_boundary",
} as const;
