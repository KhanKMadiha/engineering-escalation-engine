import { notFound } from "next/navigation";
import { CaseIssueHeader } from "@/components/cases/CaseIssueHeader";
import {
  CaseWorkspace,
  type CaseWorkspaceInitialTab,
} from "@/components/cases/CaseWorkspace";
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
  searchParams: Promise<{ tab?: string }>;
};

const INITIAL_TAB_IDS = [
  "overview",
  "investigation",
  "assessment",
  "approval",
  "handoff",
] as const satisfies readonly CaseWorkspaceInitialTab[];

function parseInitialTab(
  raw: string | undefined,
): CaseWorkspaceInitialTab | undefined {
  if (!raw) {
    return undefined;
  }
  return (INITIAL_TAB_IDS as readonly string[]).includes(raw)
    ? (raw as CaseWorkspaceInitialTab)
    : undefined;
}

export default async function CaseDetailPage({
  params,
  searchParams,
}: CaseDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab = parseInitialTab(tab);
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

  const downstreamDestinations = existingDownstreamRecords.map(
    (row) => row.destination,
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <CaseIssueHeader
        record={record}
        downstreamDestinations={downstreamDestinations}
      />
      <CaseWorkspace
        record={{ ...record, technicalEvidence }}
        existingDownstreamRecords={existingDownstreamRecords}
        initialTab={initialTab}
      />
    </div>
  );
}
