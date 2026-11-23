"use client";

import { DownstreamDemoActions } from "@/components/cases/DownstreamDemoActions";
import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import { shortenText } from "@/lib/ui/case-display";
import { supportReproducibilityLabel } from "@/lib/ui/investigation-summary";
import type { DemoDownstreamRecord, EscalationHandoff } from "@/types";
import type { ReactNode } from "react";

type CreateEscalationApprovedViewProps = {
  caseId: string;
  handoff: EscalationHandoff;
  product: string;
  customer: string;
  incidentTimestamp?: string | null;
  existingDownstreamRecords?: DemoDownstreamRecord[];
};

/**
 * Approved Create escalation landing + destination previews.
 * Single main card: header, prepared summary, equal-width destination actions.
 */
export function CreateEscalationApprovedView({
  caseId,
  handoff,
  product,
  customer,
  incidentTimestamp,
  existingDownstreamRecords = [],
}: CreateEscalationApprovedViewProps) {
  return (
    <DownstreamDemoActions
      caseId={caseId}
      handoff={handoff}
      product={product}
      customer={customer}
      incidentTimestamp={incidentTimestamp}
      existingRecords={existingDownstreamRecords}
      landing={
        <ApprovedEscalationLanding
          handoff={handoff}
          product={product}
          customer={customer}
        />
      }
    />
  );
}

function ApprovedEscalationLanding({
  handoff,
  product,
  customer,
}: {
  handoff: EscalationHandoff;
  product: string;
  customer: string;
}) {
  const reason = shortenText(
    stripDemoMarkersForDisplay(handoff.decisionRationale),
    320,
  );
  const affected =
    handoff.affectedCustomerCount === null
      ? "Not recorded"
      : String(handoff.affectedCustomerCount);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col items-start gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Create escalation
        </h2>
        <span
          className="inline-flex shrink-0 items-center rounded-md bg-success-soft px-2 py-0.5 text-sm font-medium text-success ring-1 ring-inset ring-emerald-200"
          aria-label="Approved"
        >
          ✓ Escalation approved
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Prepared escalation
        </h3>
        <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-2.5 lg:gap-x-14">
          <SummaryItem label="Issue">
            {stripDemoMarkersForDisplay(handoff.title)}
          </SummaryItem>
          <SummaryItem label="Customer">
            {stripDemoMarkersForDisplay(customer) || "Not recorded"}
          </SummaryItem>
          <SummaryItem label="Product">{product.trim() || "Not recorded"}</SummaryItem>
          <SummaryItem label="Environment">{handoff.environment}</SummaryItem>
          <SummaryItem label="Affected accounts">{affected}</SummaryItem>
          <SummaryItem label="Reproducibility">
            {supportReproducibilityLabel(handoff.reproducibility)}
          </SummaryItem>
        </dl>
        <div className="mt-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Reason for escalation
          </p>
          <p className="mt-1 text-[15px] leading-snug text-foreground">{reason}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-[15px] leading-snug text-foreground">
        {children}
      </dd>
    </div>
  );
}
