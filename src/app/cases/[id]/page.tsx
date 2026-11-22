import { notFound } from "next/navigation";
import { CaseIssueHeader } from "@/components/cases/CaseIssueHeader";
import { CaseWorkspace } from "@/components/cases/CaseWorkspace";
import { getCaseService } from "@/lib/cases/get-case-service";
import {
  assertCaseReadableByWorkspace,
  DemoCaseAccessError,
} from "@/lib/demo/demo-case-access";
import { listDemoDownstreamRecordsForVisibleCase } from "@/lib/demo/downstream-record-service";
import { getOptionalDemoWorkspaceId } from "@/lib/demo/demo-workspace-session";
import { getEvidenceService } from "@/lib/evidence/get-evidence-service";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";

type CaseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params;
  const record = await getCaseService().getCaseOrNull(id);

  if (!record) {
    notFound();
  }

  const repository = getCaseRepository();
  const workspaceId = await getOptionalDemoWorkspaceId(repository);
  try {
    assertCaseReadableByWorkspace(record, workspaceId);
  } catch (error) {
    if (error instanceof DemoCaseAccessError) {
      notFound();
    }
    throw error;
  }

  // Evidence is loaded separately from AI analysis so records persist across reassessment.
  const technicalEvidence = await getEvidenceService().listForCase(id);
  const existingDownstreamRecords =
    await listDemoDownstreamRecordsForVisibleCase({
      caseId: id,
      repository,
      workspaceId,
    });

  return (
    <div className="space-y-1">
      <div className="pb-4">
        <CaseIssueHeader record={record} />
      </div>
      <CaseWorkspace
        record={{ ...record, technicalEvidence }}
        existingDownstreamRecords={existingDownstreamRecords}
      />
    </div>
  );
}
