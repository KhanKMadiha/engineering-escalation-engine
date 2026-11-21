import {
  EnvironmentBadge,
  SeverityBadge,
} from "@/components/cases/StatusBadge";
import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import { formatDateTime } from "@/lib/format";
import { formatCaseKey } from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type CaseDetailsCardProps = {
  record: CaseRecord;
};

/** Compact static metadata for Overview right rail (above Timeline). */
export function CaseDetailsCard({ record }: CaseDetailsCardProps) {
  return (
    <aside className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Case details
      </h2>
      <dl className="mt-4 space-y-3">
        <SidebarMetaRow label="Case ID">
          <span
            className="font-mono text-[12px] text-foreground"
            title={record.id}
          >
            {formatCaseKey(record.id)}
          </span>
        </SidebarMetaRow>
        <SidebarMetaRow label="Customer">
          {stripDemoMarkerPrefix(record.customer)}
        </SidebarMetaRow>
        <SidebarMetaRow label="Product">{record.product}</SidebarMetaRow>
        <SidebarMetaRow label="Environment">
          <span className="inline-flex justify-end">
            <EnvironmentBadge environment={record.environment} />
          </span>
        </SidebarMetaRow>
        <SidebarMetaRow label="Severity">
          <span className="inline-flex justify-end">
            <SeverityBadge severity={record.severity} />
          </span>
        </SidebarMetaRow>
        <SidebarMetaRow label="Affected customer count">
          {record.affectedCustomerCount === null
            ? "—"
            : record.affectedCustomerCount}
        </SidebarMetaRow>
        <SidebarMetaRow label="Reported">
          <time dateTime={record.createdAt}>
            {formatDateTime(record.createdAt)}
          </time>
        </SidebarMetaRow>
        <SidebarMetaRow label="Updated">
          <time dateTime={record.updatedAt}>
            {formatDateTime(record.updatedAt)}
          </time>
        </SidebarMetaRow>
      </dl>
    </aside>
  );
}
