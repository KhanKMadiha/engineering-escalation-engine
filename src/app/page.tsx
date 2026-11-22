import { CaseQueueClient } from "@/components/cases/CaseQueueClient";
import { listVisibleCases } from "@/lib/demo/list-visible-cases";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cases = await listVisibleCases();
  return <CaseQueueClient cases={cases} />;
}
