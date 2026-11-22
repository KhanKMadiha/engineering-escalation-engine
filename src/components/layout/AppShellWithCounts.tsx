import { AppShell } from "@/components/layout/AppShell";
import { listVisibleCases } from "@/lib/demo/list-visible-cases";
import { buildCaseQueueStats } from "@/lib/ui/case-queue-stats";
import type { ReactNode } from "react";

/**
 * Server wrapper that supplies sidebar badge counts from real case statuses.
 * Counts respect anonymous workspace isolation (templates + own forks only).
 */
export async function AppShellWithCounts({
  children,
}: {
  children: ReactNode;
}) {
  let pendingReviewsCount = 0;
  let handoffsCount = 0;

  try {
    const cases = await listVisibleCases();
    const stats = buildCaseQueueStats(cases);
    pendingReviewsCount = stats.awaitingReview;
    handoffsCount = stats.readyForHandoff;
  } catch {
    // Layout must still render if the repository is temporarily unavailable.
  }

  return (
    <AppShell
      pendingReviewsCount={pendingReviewsCount}
      handoffsCount={handoffsCount}
    >
      {children}
    </AppShell>
  );
}
