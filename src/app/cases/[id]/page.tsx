import { notFound } from "next/navigation";
import { CaseIssueHeader } from "@/components/cases/CaseIssueHeader";
import { CaseWorkspace } from "@/components/cases/CaseWorkspace";
import { getCaseService } from "@/lib/cases/get-case-service";
import { getEvidenceService } from "@/lib/evidence/get-evidence-service";

type CaseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params;
  const record = await getCaseService().getCaseOrNull(id);

  if (!record) {
    notFound();
  }

  // Evidence is loaded separately from AI analysis so records persist across reassessment.
  const technicalEvidence = await getEvidenceService().listForCase(id);

  return (
    <div className="space-y-1">
      <div className="pb-4">
        <CaseIssueHeader record={record} />
      </div>
      <CaseWorkspace record={{ ...record, technicalEvidence }} />
    </div>
  );
}
