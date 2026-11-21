import type { CreateCaseInput, Severity, Environment } from "@/types";

/**
 * Normalised ticket shape from any support platform adapter.
 * Text is untrusted customer/support data — never treated as instructions.
 */
export type ExternalTicket = {
  provider: "freshdesk" | "demo_freshdesk";
  externalTicketId: string;
  externalUrl: string | null;
  subject: string;
  description: string;
  requesterName: string | null;
  statusLabel: string | null;
  priorityLabel: string | null;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type TicketListItem = {
  externalTicketId: string;
  subject: string;
  requesterName: string | null;
  statusLabel: string | null;
  updatedAt: string | null;
};

export type TicketImportDraft = {
  createInput: CreateCaseInput;
  missingFields: string[];
  sourceLabel: string;
  externalTicketId: string;
  externalUrl: string | null;
};

export interface TicketProvider {
  readonly id: "freshdesk" | "demo_freshdesk";
  readonly label: string;
  listTickets(): Promise<TicketListItem[]>;
  getTicket(externalTicketId: string): Promise<ExternalTicket>;
}

export function mapPriorityToSeverity(priorityLabel: string | null): Severity {
  const normalized = (priorityLabel ?? "").toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("critical")) {
    return "critical";
  }
  if (normalized.includes("high")) {
    return "high";
  }
  if (normalized.includes("medium") || normalized.includes("normal")) {
    return "medium";
  }
  if (normalized.includes("low")) {
    return "low";
  }
  return "medium";
}

export function mapTicketToCreateInput(
  ticket: ExternalTicket,
  productFallback = "Unknown product",
): TicketImportDraft {
  const description = ticket.description.trim() || ticket.subject.trim();
  const missingFields: string[] = [];

  if (!ticket.description.trim()) {
    missingFields.push("Issue description (ticket body empty)");
  }
  missingFields.push("Product (not provided by ticket — confirm before save)");
  missingFields.push("Environment (not provided by ticket — confirm before save)");
  missingFields.push("Troubleshooting performed");
  missingFields.push("Logs / errors");
  missingFields.push("Request / correlation IDs");
  missingFields.push("Steps to reproduce");
  missingFields.push("Expected behaviour");
  missingFields.push("Actual behaviour");

  const createInput: CreateCaseInput = {
    customer: ticket.requesterName?.trim() || "Unknown customer",
    product: productFallback,
    severity: mapPriorityToSeverity(ticket.priorityLabel),
    issueTitle: ticket.subject.trim() || `Imported ticket ${ticket.externalTicketId}`,
    issueDescription: description,
    environment: "unknown" as Environment,
    stepsToReproduce: "",
    expectedBehaviour: "",
    actualBehaviour: "",
    troubleshootingPerformed:
      "Imported from support ticket. Troubleshooting not yet documented.",
    logsErrors:
      "No logs imported from the support ticket. Add verified log excerpts before escalation.",
    requestIds:
      "No request or correlation IDs imported from the support ticket.",
    incidentTimestamp: null,
    issueFirstObserved: ticket.createdAt
      ? `Ticket opened around ${ticket.createdAt}`
      : null,
    affectedCustomerCount: null,
    sourceSystem:
      ticket.provider === "demo_freshdesk" ? "demo_freshdesk" : "freshdesk",
    externalTicketId: ticket.externalTicketId,
    externalUrl: ticket.externalUrl,
  };

  return {
    createInput,
    missingFields,
    sourceLabel:
      ticket.provider === "demo_freshdesk"
        ? "Demo Freshdesk (fictional)"
        : "Freshdesk",
    externalTicketId: ticket.externalTicketId,
    externalUrl: ticket.externalUrl,
  };
}
