import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { getCaseService } from "@/lib/cases/get-case-service";
import { buildActivityFeed } from "@/lib/ui/activity-feed";
import type { CaseRecord } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Cross-case activity from existing audit events on loaded cases.
 * Does not invent events.
 */
export default async function ActivityPage() {
  const service = getCaseService();
  const summaries = await service.listCases();
  const records: CaseRecord[] = [];

  for (const summary of summaries) {
    const record = await service.getCaseOrNull(summary.id);
    if (record) {
      records.push(record);
    }
  }

  const items = buildActivityFeed(records);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Activity
        </h1>
        <p className="max-w-3xl text-[15px] text-muted">
          Recent audit events across cases — intake, analysis, human decisions
          and Engineering handoffs. Events are recorded by the system; nothing
          here is fabricated.
        </p>
      </div>
      <ActivityFeed items={items} />
    </div>
  );
}
