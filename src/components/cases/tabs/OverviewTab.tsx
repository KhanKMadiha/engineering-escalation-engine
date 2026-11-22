import type { ReactNode } from "react";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import {
  EnvironmentBadge,
  SeverityBadge,
} from "@/components/cases/StatusBadge";
import { AnalysisRunPrompt } from "@/components/cases/EscalationAssessmentCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import {
  buildImpactTimeline,
  impactScopeFromCustomerCount,
  issueFrequencyRow,
} from "@/lib/ui/investigation-summary";
import type { CaseRecord } from "@/types";

type OverviewTabProps = {
  record: CaseRecord;
  /** Retained for CaseWorkspace deep-link compatibility; unused on Case details. */
  goToTab?: (tab: "overview" | "investigation" | "assessment" | "handoff") => void;
};

/**
 * Case details — reported issue overview only.
 * Assessment, approval and Investigation detail live in their own stages.
 */
export function OverviewTab({ record }: OverviewTabProps) {
  const description =
    stripDemoDescriptionBoilerplate(record.issueDescription).trim() || null;
  const frequency = issueFrequencyRow(record);
  const impact = buildImpactTimeline(record);
  const affectedUsers = impact.rows.find((row) => row.label === "Affected users");
  const scope = impactScopeFromCustomerCount(record.affectedCustomerCount);
  const issueStarted = impact.rows.find((row) => row.label === "Issue started");

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-6"
      sidebarClassName="space-y-6"
      main={
        <>
          <Card padding="lg">
            <CardHeader title="Reported issue" />
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-medium text-muted">
                  Issue description
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                  {description || "No issue description provided."}
                </p>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Affected product">
                  {record.product.trim() || "Not recorded"}
                </DetailField>
                <DetailField label="Environment">
                  <EnvironmentBadge environment={record.environment} />
                </DetailField>
                <DetailField label="Severity">
                  <SeverityBadge severity={record.severity} />
                </DetailField>
                <DetailField label="Affected organisations">
                  {record.affectedCustomerCount === null
                    ? "Not recorded"
                    : String(record.affectedCustomerCount)}
                </DetailField>
                <DetailField label="Frequency">
                  <span
                    className={
                      frequency.provenance === "not_recorded"
                        ? "text-muted"
                        : undefined
                    }
                  >
                    {frequency.value}
                  </span>
                </DetailField>
                <DetailField label="Impact scope">
                  <span
                    className={
                      record.affectedCustomerCount === null
                        ? "text-muted"
                        : undefined
                    }
                  >
                    {scope === "Unknown" ? "Not recorded" : scope}
                  </span>
                </DetailField>
                {affectedUsers &&
                affectedUsers.provenance !== "not_recorded" ? (
                  <DetailField label="Affected users">
                    {affectedUsers.value}
                  </DetailField>
                ) : null}
                {issueStarted &&
                issueStarted.provenance !== "not_recorded" ? (
                  <DetailField label="Issue started">
                    {issueStarted.value}
                  </DetailField>
                ) : null}
              </dl>
            </div>
          </Card>

          {!record.analysis &&
          (record.status === "draft" ||
            record.status === "submitted" ||
            record.status === "analyzing") ? (
            <AnalysisRunPrompt
              caseId={record.id}
              status={record.status}
              hasEscalationResult={Boolean(record.escalationResult)}
            />
          ) : null}
        </>
      }
      sidebar={<CaseDetailsCard record={record} />}
    />
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 text-[15px] text-foreground">{children}</dd>
    </div>
  );
}
