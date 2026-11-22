import { getOptionalDemoWorkspaceId } from "@/lib/demo/demo-workspace-session";
import { getCaseService } from "@/lib/cases/get-case-service";
import type { CaseListFilters, SupportCaseSummary } from "@/types";

/**
 * List cases visible to the current visitor:
 * shared templates + private forks for their workspace (if any).
 * Does not create a workspace.
 */
export async function listVisibleCases(
  filters?: Omit<CaseListFilters, "demoWorkspaceId" | "includeSharedTemplates">,
): Promise<SupportCaseSummary[]> {
  const workspaceId = await getOptionalDemoWorkspaceId();
  return getCaseService().listCases({
    ...filters,
    demoWorkspaceId: workspaceId,
    includeSharedTemplates: true,
  });
}
