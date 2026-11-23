import { StatusBadge } from "@/components/cases/StatusBadge";
import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import { formatDateTime } from "@/lib/format";
import { formatCaseKey } from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type CaseDetailsCardProps = {
  record: CaseRecord;
};

/**
 * Operational metadata for workflow sidebars.
 * Product / severity / environment / impact live on Reported issue / Investigation.
 */
export function CaseDetailsCard({ record }: CaseDetailsCardProps) {
  return (
    <aside className="rounded-[var(--radius-card)] border border-border bg-surface p-3.5 shadow-[var(--shadow-card)] sm:p-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        Case details
      </h2>
      <dl className="mt-3 space-y-2.5">
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
        <SidebarMetaRow label="Status">
          <span className="inline-flex justify-end">
            <StatusBadge
              status={record.status}
              recommendation={record.escalationResult?.recommendation}
            />
          </span>
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
