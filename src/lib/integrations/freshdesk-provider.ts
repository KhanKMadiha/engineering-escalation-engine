import "server-only";

import type {
  ExternalTicket,
  TicketListItem,
  TicketProvider,
} from "@/lib/integrations/ticket-provider";

export type FreshdeskEnv = {
  FRESHDESK_DOMAIN?: string;
  FRESHDESK_API_KEY?: string;
  [key: string]: string | undefined;
};

/**
 * True when real Freshdesk credentials are configured.
 * Domain must be a hostname only (no scheme); never accept a user-supplied host.
 */
export function isFreshdeskConfigured(
  env: FreshdeskEnv = process.env as FreshdeskEnv,
): boolean {
  const domain = env.FRESHDESK_DOMAIN?.trim() ?? "";
  const key = env.FRESHDESK_API_KEY?.trim() ?? "";
  return domain.length > 0 && key.length > 0 && isSafeFreshdeskDomain(domain);
}

function isSafeFreshdeskDomain(domain: string): boolean {
  if (domain.includes("://") || domain.includes("/") || domain.includes(" ")) {
    return false;
  }
  return /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
}

/**
 * Read-only Freshdesk API adapter. Server-only secrets.
 * Does not write back to Freshdesk.
 */
export class FreshdeskProvider implements TicketProvider {
  readonly id = "freshdesk" as const;
  readonly label = "Freshdesk";

  constructor(
    private readonly domain: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!isSafeFreshdeskDomain(domain)) {
      throw new Error("Invalid FRESHDESK_DOMAIN");
    }
  }

  static fromEnv(env: FreshdeskEnv = process.env as FreshdeskEnv): FreshdeskProvider {
    const domain = env.FRESHDESK_DOMAIN?.trim() ?? "";
    const apiKey = env.FRESHDESK_API_KEY?.trim() ?? "";
    if (!isFreshdeskConfigured(env)) {
      throw new Error(
        "Freshdesk is not configured. Set FRESHDESK_DOMAIN and FRESHDESK_API_KEY.",
      );
    }
    return new FreshdeskProvider(domain, apiKey);
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.apiKey}:X`).toString("base64");
    return `Basic ${token}`;
  }

  private baseUrl(): string {
    return `https://${this.domain}/api/v2`;
  }

  async listTickets(): Promise<TicketListItem[]> {
    const response = await this.fetchImpl(`${this.baseUrl()}/tickets?per_page=30`, {
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Freshdesk list failed (${response.status})`);
    }
    const payload = (await response.json()) as Array<{
      id: number;
      subject?: string;
      status_label?: string;
      updated_at?: string;
      requester_id?: number;
    }>;
    return payload.map((item) => ({
      externalTicketId: String(item.id),
      subject: item.subject ?? `Ticket ${item.id}`,
      requesterName: null,
      statusLabel: item.status_label ?? null,
      updatedAt: item.updated_at ?? null,
    }));
  }

  async getTicket(externalTicketId: string): Promise<ExternalTicket> {
    const id = encodeURIComponent(externalTicketId.trim());
    const response = await this.fetchImpl(`${this.baseUrl()}/tickets/${id}`, {
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (response.status === 404) {
      throw new Error(`Freshdesk ticket not found: ${externalTicketId}`);
    }
    if (!response.ok) {
      throw new Error(`Freshdesk fetch failed (${response.status})`);
    }
    const ticket = (await response.json()) as {
      id: number;
      subject?: string;
      description_text?: string;
      description?: string;
      priority?: number;
      status?: number;
      created_at?: string;
      updated_at?: string;
      tags?: string[];
      requester_id?: number;
    };

    const priorityLabel =
      ticket.priority === 4
        ? "Urgent"
        : ticket.priority === 3
          ? "High"
          : ticket.priority === 2
            ? "Medium"
            : ticket.priority === 1
              ? "Low"
              : null;

    return {
      provider: "freshdesk",
      externalTicketId: String(ticket.id),
      externalUrl: `https://${this.domain}/a/tickets/${ticket.id}`,
      subject: ticket.subject ?? `Ticket ${ticket.id}`,
      description:
        ticket.description_text?.trim() ||
        stripHtml(ticket.description ?? "") ||
        ticket.subject ||
        "",
      requesterName: null,
      statusLabel: ticket.status != null ? String(ticket.status) : null,
      priorityLabel,
      tags: Array.isArray(ticket.tags) ? ticket.tags.map(String) : [],
      createdAt: ticket.created_at ?? null,
      updatedAt: ticket.updated_at ?? null,
    };
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
