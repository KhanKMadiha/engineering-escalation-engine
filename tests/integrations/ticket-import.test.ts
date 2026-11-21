import { beforeEach, describe, expect, it } from "vitest";
import { DemoFreshdeskProvider } from "@/lib/integrations/demo-freshdesk-provider";
import {
  createCaseFromTicketImport,
  DuplicateTicketImportError,
  previewTicketImport,
} from "@/lib/integrations/ticket-import-service";
import { mapTicketToCreateInput } from "@/lib/integrations/ticket-provider";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { resetRequestGuards } from "@/lib/security/request-guards";

describe("ticket import", () => {
  beforeEach(() => {
    resetRequestGuards();
  });

  it("maps demo Freshdesk tickets without inventing logs or request IDs", async () => {
    const provider = new DemoFreshdeskProvider();
    const ticket = await provider.getTicket("FD-1042");
    const draft = mapTicketToCreateInput(ticket);
    expect(draft.sourceLabel).toContain("Demo");
    expect(draft.missingFields.length).toBeGreaterThan(0);
    expect(draft.createInput.logsErrors).toMatch(/No logs imported/i);
    expect(draft.createInput.requestIds).toMatch(/No request/i);
    expect(draft.createInput.sourceSystem).toBe("demo_freshdesk");
    expect(draft.createInput.externalTicketId).toBe("FD-1042");
  });

  it("creates a case from a preview and records ticket_imported", async () => {
    const repo = new InMemoryCaseRepository();
    const draft = await previewTicketImport({
      providerId: "demo_freshdesk",
      externalTicketId: "FD-1108",
    });
    const created = await createCaseFromTicketImport({
      repository: repo,
      draft: {
        ...draft.createInput,
        product: "SSO",
        environment: "production",
      },
    });
    const record = await repo.getCaseWithDetails(created.id);
    expect(record?.sourceSystem).toBe("demo_freshdesk");
    expect(record?.externalTicketId).toBe("FD-1108");
    expect(
      record?.events.some((event) => event.eventType === "ticket_imported"),
    ).toBe(true);
  });

  it("rejects duplicate imports for the same external ticket", async () => {
    const repo = new InMemoryCaseRepository();
    const draft = await previewTicketImport({
      providerId: "demo_freshdesk",
      externalTicketId: "FD-1187",
    });
    const input = {
      ...draft.createInput,
      product: "MS Teams Integration",
      environment: "production" as const,
    };
    await createCaseFromTicketImport({ repository: repo, draft: input });
    await expect(
      createCaseFromTicketImport({ repository: repo, draft: input }),
    ).rejects.toBeInstanceOf(DuplicateTicketImportError);
  });
});
