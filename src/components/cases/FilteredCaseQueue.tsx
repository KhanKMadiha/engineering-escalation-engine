"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaseListTable } from "@/components/cases/CaseListTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import type { SupportCaseSummary } from "@/types";

type FilteredCaseQueueProps = {
  cases: SupportCaseSummary[];
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

/**
 * Filtered case list for Operations views (Pending reviews, Handoffs).
 * Cases are pre-filtered by the server using real CaseStatus values.
 */
export function FilteredCaseQueue({
  cases,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: FilteredCaseQueueProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => {
      const customer = stripDemoMarkerPrefix(item.customer).toLowerCase();
      const issue = stripDemoMarkerPrefix(item.issueTitle).toLowerCase();
      const id = item.id.toLowerCase();
      return customer.includes(q) || issue.includes(q) || id.includes(q);
    });
  }, [cases, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-3xl text-[15px] text-muted">{description}</p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{cases.length}</span>
            {" case"}
            {cases.length === 1 ? "" : "s"}
            {" matching this filter"}
          </p>
        </div>
        <Link href="/" className="shrink-0">
          <Button variant="secondary" size="md">
            View full queue
          </Button>
        </Link>
      </div>

      <Card padding="md">
        <label
          htmlFor="filtered-case-search"
          className="block text-sm font-medium text-muted"
        >
          Search
        </label>
        <input
          id="filtered-case-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by case ID, customer or issue..."
          className="mt-1.5 block w-full max-w-xl rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[15px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </Card>

      {cases.length === 0 ? (
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground">{emptyTitle}</h2>
          <p className="mt-1.5 text-[15px] text-muted">{emptyDescription}</p>
          <Link href="/" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              Back to case queue
            </Button>
          </Link>
        </Card>
      ) : (
        <CaseListTable cases={filtered} />
      )}
    </div>
  );
}
