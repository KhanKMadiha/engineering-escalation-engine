import { notFound } from "next/navigation";
import { CaseIssueHeader } from "@/components/cases/CaseIssueHeader";
import { CaseWorkspace } from "@/components/cases/CaseWorkspace";
import { getCaseService } from "@/lib/cases/get-case-service";

type CaseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params;
  const record = await getCaseService().getCaseOrNull(id);

  if (!record) {
    notFound();
  }

  return (
    <>
      <div className="pb-5">
        <CaseIssueHeader record={record} />
      </div>
      <CaseWorkspace record={record} />
    </>
  );
}
