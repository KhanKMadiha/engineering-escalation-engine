"use client";

import Link from "next/link";
import { useState } from "react";
import { CaseForm } from "@/components/cases/CaseForm";
import { TicketImportPanel } from "@/components/cases/TicketImportPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type EntryMode = "choose" | "manual" | "import";

/**
 * New case entry: choose manual create or ticket import.
 */
export function NewCaseEntry() {
  const [mode, setMode] = useState<EntryMode>("choose");

  if (mode === "manual") {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back to options
        </button>
        <CaseForm />
      </div>
    );
  }

  if (mode === "import") {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back to options
        </button>
        <TicketImportPanel />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            New support case
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            Import an existing support ticket or create a case manually. Analysis
            and escalation recommendation are added in later steps.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <Card
          padding="lg"
          className="flex min-h-[16rem] flex-col border-accent/25 bg-accent-soft/20"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Recommended for demo
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Import support ticket
          </h2>
          <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">
            Start from a Freshdesk ticket. Demo tickets are available without a
            real account — select a fictional ticket, review missing evidence,
            then confirm.
          </p>
          <div className="mt-6">
            <Button type="button" size="lg" onClick={() => setMode("import")}>
              Import ticket
            </Button>
          </div>
        </Card>
        <Card padding="lg" className="flex min-h-[16rem] flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Manual intake
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Create manually
          </h2>
          <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">
            Enter customer-provided issue details and technical evidence using
            the existing intake form.
          </p>
          <div className="mt-6">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setMode("manual")}
            >
              Create manually
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
