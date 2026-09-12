import {
  EnvironmentBadge,
  SeverityBadge,
} from "@/components/cases/StatusBadge";
import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import { formatCaseKey } from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type CaseDetailsCardProps = {
  record: CaseRecord;
};

/** Compact static metadata for Overview right rail (above Timeline). */
export function CaseDetailsCard({ record }: CaseDetailsCardProps) {
  return (
    <aside>
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Case details
      </h2>
      <dl className="mt-3 space-y-2">
        <SidebarMetaRow label="Case ID">
          <span
            className="font-mono text-[11px] text-slate-800"
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
      </dl>
    </aside>
  );
}
