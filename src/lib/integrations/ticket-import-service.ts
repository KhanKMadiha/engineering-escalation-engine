import { createCaseEvent } from "@/lib/audit/case-events";
import {
  DemoFreshdeskProvider,
} from "@/lib/integrations/demo-freshdesk-provider";
import {
  FreshdeskProvider,
  isFreshdeskConfigured,
} from "@/lib/integrations/freshdesk-provider";
import {
  mapTicketToCreateInput,
  type TicketImportDraft,
  type TicketListItem,
  type TicketProvider,
} from "@/lib/integrations/ticket-provider";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type { CreateCaseInput, SupportCase } from "@/types";

export class DuplicateTicketImportError extends Error {
  readonly existingCaseId: string;

  constructor(existingCaseId: string) {
    super("A case already exists for this support ticket.");
    this.name = "DuplicateTicketImportError";
    this.existingCaseId = existingCaseId;
  }
}

export function resolveTicketProviders(): TicketProvider[] {
  const providers: TicketProvider[] = [new DemoFreshdeskProvider()];
  if (isFreshdeskConfigured()) {
    providers.unshift(FreshdeskProvider.fromEnv());
  }
  return providers;
}

export function getTicketProvider(providerId: string): TicketProvider {
  const providers = resolveTicketProviders();
  const match = providers.find((provider) => provider.id === providerId);
  if (!match) {
    throw new Error(`Unknown ticket provider: ${providerId}`);
  }
  return match;
}

/**
 * Builds an editable import draft from a provider ticket.
 * Does not persist. Callers must confirm missing evidence before create.
 */
export async function previewTicketImport(input: {
  providerId: string;
  externalTicketId: string;
}): Promise<TicketImportDraft> {
  const provider = getTicketProvider(input.providerId);
  const ticket = await provider.getTicket(input.externalTicketId);
  return mapTicketToCreateInput(ticket);
}

export async function listImportableTickets(
  providerId: string,
): Promise<TicketListItem[]> {
  return getTicketProvider(providerId).listTickets();
}

/**
 * Creates a case from a confirmed import draft through CaseRepository.
 * Enforces idempotency on (sourceSystem, externalTicketId).
 */
export async function createCaseFromTicketImport(options: {
  repository: CaseRepository;
  draft: CreateCaseInput;
}): Promise<SupportCase> {
  const validation = validateCreateCaseInput(options.draft);
  if (!validation.success) {
    throw new Error(validation.formError ?? "Imported case failed validation");
  }

  const data = validation.data;
  const sourceSystem = data.sourceSystem ?? null;
  const externalTicketId = data.externalTicketId?.trim() || null;

  if (sourceSystem && externalTicketId) {
    const existing = await options.repository.findByExternalTicket(
      sourceSystem,
      externalTicketId,
    );
    if (existing) {
      throw new DuplicateTicketImportError(existing.id);
    }
  }

  const created = await options.repository.createCase(data);

  await options.repository.appendEvent(
    created.id,
    createCaseEvent({
      caseId: created.id,
      eventType: "ticket_imported",
      metadata: {
        sourceSystem: data.sourceSystem ?? null,
        externalTicketId: data.externalTicketId ?? null,
        externalUrl: data.externalUrl ?? null,
      },
    }),
  );

  return created;
}
