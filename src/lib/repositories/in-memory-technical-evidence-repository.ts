import type {
  CreateTechnicalEvidenceInput,
  TechnicalEvidenceAttachment,
  TechnicalEvidenceRecord,
  UpdateTechnicalEvidenceInput,
} from "@/lib/evidence/evidence-types";
import type {
  CreateAttachmentInput,
  TechnicalEvidenceRepository,
} from "@/lib/repositories/technical-evidence-repository";

type Store = {
  evidence: Map<string, TechnicalEvidenceRecord>;
  attachmentBytes: Map<string, Uint8Array>;
};

const GLOBAL_KEY = "__eee_technical_evidence_store__";

function getStore(): Store {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Store;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      evidence: new Map(),
      attachmentBytes: new Map(),
    };
  }
  return g[GLOBAL_KEY];
}

export class InMemoryTechnicalEvidenceRepository
  implements TechnicalEvidenceRepository
{
  async listByCaseId(caseId: string): Promise<TechnicalEvidenceRecord[]> {
    const items = [...getStore().evidence.values()].filter(
      (item) => item.caseId === caseId,
    );
    return items
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .map((item) => structuredClone(item));
  }

  async getById(evidenceId: string): Promise<TechnicalEvidenceRecord | null> {
    const item = getStore().evidence.get(evidenceId);
    return item ? structuredClone(item) : null;
  }

  async create(
    input: CreateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord> {
    const now = new Date().toISOString();
    const record: TechnicalEvidenceRecord = {
      id: crypto.randomUUID(),
      caseId: input.caseId,
      evidenceType: input.evidenceType,
      title: input.title.trim(),
      service: input.service?.trim() || null,
      body: input.body?.trim() || null,
      caption: input.caption?.trim() || null,
      capturedAt: input.capturedAt ?? null,
      requestId: input.requestId?.trim() || null,
      traceId: input.traceId?.trim() || null,
      externalUrl: input.externalUrl?.trim() || null,
      source: input.source,
      verificationStatus:
        input.verificationStatus ??
        (input.source === "demo_fictional" ? "demo_fictional" : "recorded"),
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      attachments: [],
    };
    getStore().evidence.set(record.id, record);
    return structuredClone(record);
  }

  async update(
    evidenceId: string,
    input: UpdateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord> {
    const existing = getStore().evidence.get(evidenceId);
    if (!existing) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    const updated: TechnicalEvidenceRecord = {
      ...existing,
      title: input.title?.trim() ?? existing.title,
      evidenceType: input.evidenceType ?? existing.evidenceType,
      service:
        input.service === undefined
          ? existing.service
          : input.service?.trim() || null,
      body:
        input.body === undefined ? existing.body : input.body?.trim() || null,
      caption:
        input.caption === undefined
          ? existing.caption
          : input.caption?.trim() || null,
      capturedAt:
        input.capturedAt === undefined
          ? existing.capturedAt
          : input.capturedAt,
      requestId:
        input.requestId === undefined
          ? existing.requestId
          : input.requestId?.trim() || null,
      traceId:
        input.traceId === undefined
          ? existing.traceId
          : input.traceId?.trim() || null,
      externalUrl:
        input.externalUrl === undefined
          ? existing.externalUrl
          : input.externalUrl?.trim() || null,
      source: input.source ?? existing.source,
      verificationStatus:
        input.verificationStatus ?? existing.verificationStatus,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: new Date().toISOString(),
    };
    getStore().evidence.set(evidenceId, updated);
    return structuredClone(updated);
  }

  async delete(evidenceId: string): Promise<void> {
    const existing = getStore().evidence.get(evidenceId);
    if (!existing) {
      return;
    }
    for (const attachment of existing.attachments) {
      getStore().attachmentBytes.delete(attachment.id);
    }
    getStore().evidence.delete(evidenceId);
  }

  async addAttachment(
    input: CreateAttachmentInput,
  ): Promise<TechnicalEvidenceAttachment> {
    const evidence = getStore().evidence.get(input.evidenceId);
    if (!evidence) {
      throw new Error(`Evidence not found: ${input.evidenceId}`);
    }
    const attachment: TechnicalEvidenceAttachment = {
      id: crypto.randomUUID(),
      evidenceId: input.evidenceId,
      storagePath: input.storagePath,
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.byteSize,
      widthPx: input.widthPx ?? null,
      heightPx: input.heightPx ?? null,
      checksumSha256: input.checksumSha256 ?? null,
      createdAt: new Date().toISOString(),
    };
    evidence.attachments = [...evidence.attachments, attachment];
    evidence.updatedAt = new Date().toISOString();
    getStore().evidence.set(evidence.id, evidence);
    if (input.bytes) {
      getStore().attachmentBytes.set(attachment.id, input.bytes);
    }
    return structuredClone(attachment);
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    for (const evidence of getStore().evidence.values()) {
      const next = evidence.attachments.filter((a) => a.id !== attachmentId);
      if (next.length !== evidence.attachments.length) {
        evidence.attachments = next;
        evidence.updatedAt = new Date().toISOString();
        getStore().evidence.set(evidence.id, evidence);
        getStore().attachmentBytes.delete(attachmentId);
        return;
      }
    }
  }

  async getAttachment(
    attachmentId: string,
  ): Promise<(TechnicalEvidenceAttachment & { bytes?: Uint8Array }) | null> {
    for (const evidence of getStore().evidence.values()) {
      const attachment = evidence.attachments.find((a) => a.id === attachmentId);
      if (attachment) {
        return {
          ...structuredClone(attachment),
          bytes: getStore().attachmentBytes.get(attachmentId),
        };
      }
    }
    return null;
  }

  async readAttachmentBytes(
    attachment: TechnicalEvidenceAttachment,
  ): Promise<Uint8Array | null> {
    return getStore().attachmentBytes.get(attachment.id) ?? null;
  }

  async createPreviewUrl(
    attachment: TechnicalEvidenceAttachment,
  ): Promise<string | null> {
    void attachment;
    // Prefer authorised app download routes over embedding bytes in HTML.
    return null;
  }
}

let singleton: InMemoryTechnicalEvidenceRepository | null = null;

export function getInMemoryTechnicalEvidenceRepository(): InMemoryTechnicalEvidenceRepository {
  if (!singleton) {
    singleton = new InMemoryTechnicalEvidenceRepository();
  }
  return singleton;
}

export function resetInMemoryTechnicalEvidenceRepository(): void {
  singleton = null;
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Store;
  };
  delete g[GLOBAL_KEY];
}
