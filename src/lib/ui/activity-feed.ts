import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import type { CaseEvent, CaseRecord } from "@/types";

export type ActivityFeedItem = {
  event: CaseEvent;
  caseId: string;
  caseTitle: string;
  customer: string;
};

/**
 * Builds a cross-case activity feed from existing CaseRecord events only.
 * Does not invent or fabricate events.
 */
export function buildActivityFeed(
  records: CaseRecord[],
  limit = 50,
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];

  for (const record of records) {
    const caseTitle = stripDemoMarkerPrefix(record.issueTitle);
    const customer = stripDemoMarkerPrefix(record.customer);
    for (const event of record.events) {
      items.push({
        event,
        caseId: record.id,
        caseTitle,
        customer,
      });
    }
  }

  items.sort((a, b) => {
    const ta = Date.parse(a.event.createdAt);
    const tb = Date.parse(b.event.createdAt);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });

  return items.slice(0, limit);
}
