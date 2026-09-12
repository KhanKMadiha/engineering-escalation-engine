import type { CaseEventType } from "@/types";

/**
 * Builds a chronologically valid demo event timeline from a fixed reportedAt.
 * Presentation/seed only — does not invent domain evidence.
 */
export function buildDemoEventTimestamps(
  reportedAt: string,
  eventTypesInOrder: CaseEventType[],
): string[] {
  const base = Date.parse(reportedAt);
  if (Number.isNaN(base)) {
    throw new Error(`Invalid demo reportedAt: ${reportedAt}`);
  }

  // Fixed 4-minute steps keep audit order readable and deterministic.
  const STEP_MS = 4 * 60 * 1000;
  return eventTypesInOrder.map((_, index) =>
    new Date(base + index * STEP_MS).toISOString(),
  );
}

export type DemoSeedTimestampRewrite = {
  createdAt: string;
  updatedAt: string;
  analysisCreatedAt: string | null;
  /** Parallel to events sorted by current createdAt ascending. */
  eventCreatedAts: string[];
};
