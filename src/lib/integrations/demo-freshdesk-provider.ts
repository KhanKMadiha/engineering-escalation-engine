import type {
  ExternalTicket,
  TicketListItem,
  TicketProvider,
} from "@/lib/integrations/ticket-provider";

/**
 * Fictional Freshdesk tickets for the public portfolio demo.
 * No network I/O. Explicitly labelled as demo data.
 */
const DEMO_TICKETS: ExternalTicket[] = [
  {
    provider: "demo_freshdesk",
    externalTicketId: "FD-1042",
    externalUrl: null,
    subject: "Intermittent API authentication failures in production",
    description: [
      "Customer reports intermittent 401 Unauthorized responses when calling the production API with valid credentials.",
      "Failure rate estimated around 30–40% during peak hours.",
      "No complete application logs attached yet.",
    ].join("\n"),
    requesterName: "Northstar Financial (demo contact)",
    statusLabel: "Open",
    priorityLabel: "High",
    tags: ["api", "auth", "production"],
    createdAt: "2026-09-08T08:40:00.000Z",
    updatedAt: "2026-09-08T10:15:00.000Z",
  },
  {
    provider: "demo_freshdesk",
    externalTicketId: "FD-1108",
    externalUrl: null,
    subject: "SSO login failures after IdP certificate rotation",
    description: [
      "Some users cannot complete SSO after a recent identity provider certificate rotation.",
      "Customer suspects configuration, but evidence is incomplete.",
      "No SAML failure package attached.",
    ].join("\n"),
    requesterName: "Meridian Systems (demo contact)",
    statusLabel: "Pending",
    priorityLabel: "Medium",
    tags: ["sso", "idp"],
    createdAt: "2026-09-11T09:05:00.000Z",
    updatedAt: "2026-09-11T09:50:00.000Z",
  },
  {
    provider: "demo_freshdesk",
    externalTicketId: "FD-1187",
    externalUrl: null,
    subject: "MS Teams Auto-Answer not responding in public channels",
    description: [
      "Auto-Answer fails in public Teams channels while still working in some private channels.",
      "Channel permissions and bot membership are not fully ruled out.",
    ].join("\n"),
    requesterName: "Apex Digital (demo contact)",
    statusLabel: "Open",
    priorityLabel: "High",
    tags: ["teams", "auto-answer"],
    createdAt: "2026-09-12T08:20:00.000Z",
    updatedAt: "2026-09-12T09:00:00.000Z",
  },
];

export class DemoFreshdeskProvider implements TicketProvider {
  readonly id = "demo_freshdesk" as const;
  readonly label = "Freshdesk (demo tickets)";

  async listTickets(): Promise<TicketListItem[]> {
    return DEMO_TICKETS.map((ticket) => ({
      externalTicketId: ticket.externalTicketId,
      subject: ticket.subject,
      requesterName: ticket.requesterName,
      statusLabel: ticket.statusLabel,
      updatedAt: ticket.updatedAt,
    }));
  }

  async getTicket(externalTicketId: string): Promise<ExternalTicket> {
    const ticket = DEMO_TICKETS.find(
      (item) => item.externalTicketId === externalTicketId,
    );
    if (!ticket) {
      throw new Error(`Demo ticket not found: ${externalTicketId}`);
    }
    return structuredClone(ticket);
  }
}
