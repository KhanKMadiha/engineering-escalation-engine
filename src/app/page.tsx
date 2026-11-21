import { CaseQueueClient } from "@/components/cases/CaseQueueClient";
import { getCaseService } from "@/lib/cases/get-case-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cases = await getCaseService().listCases();
  return <CaseQueueClient cases={cases} />;
}
