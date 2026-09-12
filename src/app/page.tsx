import Link from "next/link";
import { CaseListTable } from "@/components/cases/CaseListTable";
import { PageSection } from "@/components/layout/PageSection";
import { getCaseService } from "@/lib/cases/get-case-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cases = await getCaseService().listCases();

  return (
    <PageSection
      title="Cases"
      description="Open and recent support cases. Review case status, recommendations and escalation progress."
      notice={
        <p className="max-w-2xl text-sm text-slate-500">
          <span className="font-medium text-slate-600">Demo environment</span>
          <span className="text-slate-400"> · </span>
          <span>
            All cases shown are fictional and contain no real customer data.
          </span>
        </p>
      }
      actions={
        <Link
          href="/cases/new"
          className="inline-flex items-center rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          New case
        </Link>
      }
    >
      <CaseListTable cases={cases} />
    </PageSection>
  );
}
