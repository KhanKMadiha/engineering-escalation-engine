import { createHash } from "node:crypto";
import { createCaseEvent } from "@/lib/audit/case-events";
import type {
  CreateTechnicalEvidenceInput,
  TechnicalEvidenceAttachment,
  TechnicalEvidenceRecord,
  UpdateTechnicalEvidenceInput,
} from "@/lib/evidence/evidence-types";
import {
  validateCreateTechnicalEvidence,
  validateEvidenceImageFile,
  validateUpdateTechnicalEvidence,
} from "@/lib/evidence/evidence-validators";
import { CaseNotFoundError } from "@/lib/cases/case-service";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type { TechnicalEvidenceRepository } from "@/lib/repositories/technical-evidence-repository";

export class EvidenceNotFoundError extends Error {
  constructor(evidenceId: string) {
    super(`Evidence not found: ${evidenceId}`);
    this.name = "EvidenceNotFoundError";
  }
}

export class EvidenceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceAccessError";
  }
}

/**
 * Domain service for Phase B technical evidence.
 * Verifies case existence before any read/write. Does not alter scoring/AI.
 */
export class TechnicalEvidenceService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly evidence: TechnicalEvidenceRepository,
  ) {}

  async listForCase(caseId: string): Promise<TechnicalEvidenceRecord[]> {
    await this.requireCase(caseId);
    const items = await this.evidence.listByCaseId(caseId);
    return Promise.all(items.map((item) => this.withPreviewUrls(item)));
  }

  async getForCase(
    caseId: string,
    evidenceId: string,
  ): Promise<TechnicalEvidenceRecord> {
    await this.requireCase(caseId);
    const item = await this.evidence.getById(evidenceId);
    if (!item || item.caseId !== caseId) {
      throw new EvidenceNotFoundError(evidenceId);
    }
    return this.withPreviewUrls(item);
  }

  async create(
    input: CreateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord> {
    const validation = validateCreateTechnicalEvidence(input);
    if (!validation.success) {
      throw new EvidenceAccessError(validation.formError);
    }
    await this.requireCase(validation.data.caseId);
    const created = await this.evidence.create(validation.data);
    await this.cases.appendEvent(
      validation.data.caseId,
      createCaseEvent({
        caseId: validation.data.caseId,
        eventType: "technical_evidence_added",
        metadata: {
          evidenceId: created.id,
          evidenceType: created.evidenceType,
          title: created.title,
          source: created.source,
          verificationStatus: created.verificationStatus,
        },
      }),
    );
    return created;
  }

  async update(
    caseId: string,
    evidenceId: string,
    input: UpdateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord> {
    const validation = validateUpdateTechnicalEvidence(input);
    if (!validation.success) {
      throw new EvidenceAccessError(validation.formError);
    }
    const existing = await this.getForCase(caseId, evidenceId);
    const updated = await this.evidence.update(evidenceId, validation.data);
    await this.cases.appendEvent(
      caseId,
      createCaseEvent({
        caseId,
        eventType: "technical_evidence_updated",
        metadata: {
          evidenceId,
          title: updated.title,
          previousTitle: existing.title,
        },
      }),
    );
    return this.withPreviewUrls(updated);
  }

  async delete(caseId: string, evidenceId: string): Promise<void> {
    const existing = await this.getForCase(caseId, evidenceId);
    await this.evidence.delete(evidenceId);
    await this.cases.appendEvent(
      caseId,
      createCaseEvent({
        caseId,
        eventType: "technical_evidence_deleted",
        metadata: {
          evidenceId,
          evidenceType: existing.evidenceType,
          title: existing.title,
          attachmentCount: existing.attachments.length,
        },
      }),
    );
  }

  async addScreenshot(input: {
    caseId: string;
    evidenceId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<TechnicalEvidenceAttachment> {
    const evidence = await this.getForCase(input.caseId, input.evidenceId);
    const fileCheck = validateEvidenceImageFile({
      type: input.contentType,
      size: input.bytes.byteLength,
      name: input.fileName,
    });
    if (!fileCheck.ok) {
      throw new EvidenceAccessError(fileCheck.error);
    }

    const checksum = createHash("sha256").update(input.bytes).digest("hex");
    const extension =
      input.contentType === "image/png"
        ? "png"
        : input.contentType === "image/webp"
          ? "webp"
          : "jpg";
    const storagePath = `${input.caseId}/${input.evidenceId}/${crypto.randomUUID()}.${extension}`;

    const attachment = await this.evidence.addAttachment({
      evidenceId: evidence.id,
      storagePath,
      fileName: input.fileName,
      contentType: input.contentType as TechnicalEvidenceAttachment["contentType"],
      byteSize: input.bytes.byteLength,
      checksumSha256: checksum,
      bytes: input.bytes,
    });

    await this.cases.appendEvent(
      input.caseId,
      createCaseEvent({
        caseId: input.caseId,
        eventType: "technical_evidence_attachment_added",
        metadata: {
          evidenceId: evidence.id,
          attachmentId: attachment.id,
          contentType: attachment.contentType,
          byteSize: attachment.byteSize,
          fileName: attachment.fileName,
        },
      }),
    );

    const previewUrl = await this.evidence.createPreviewUrl(attachment);
    return { ...attachment, previewUrl };
  }

  async deleteAttachment(
    caseId: string,
    evidenceId: string,
    attachmentId: string,
  ): Promise<void> {
    const evidence = await this.getForCase(caseId, evidenceId);
    const attachment = evidence.attachments.find((item) => item.id === attachmentId);
    if (!attachment) {
      throw new EvidenceNotFoundError(attachmentId);
    }
    await this.evidence.deleteAttachment(attachmentId);
    await this.cases.appendEvent(
      caseId,
      createCaseEvent({
        caseId,
        eventType: "technical_evidence_attachment_deleted",
        metadata: {
          evidenceId,
          attachmentId,
          fileName: attachment.fileName,
        },
      }),
    );
  }

  async getAttachmentForCase(
    caseId: string,
    attachmentId: string,
  ): Promise<TechnicalEvidenceAttachment & { bytes?: Uint8Array }> {
    await this.requireCase(caseId);
    const attachment = await this.evidence.getAttachment(attachmentId);
    if (!attachment) {
      throw new EvidenceNotFoundError(attachmentId);
    }
    const evidence = await this.evidence.getById(attachment.evidenceId);
    if (!evidence || evidence.caseId !== caseId) {
      throw new EvidenceAccessError("Attachment does not belong to this case.");
    }
    return attachment;
  }

  /**
   * Authorised download — verifies case ownership before reading bytes.
   * Never returns a guessable public storage URL.
   */
  async downloadAttachmentForCase(
    caseId: string,
    attachmentId: string,
  ): Promise<{
    fileName: string;
    contentType: TechnicalEvidenceAttachment["contentType"];
    bytes: Uint8Array;
  }> {
    const attachment = await this.getAttachmentForCase(caseId, attachmentId);
    const bytes =
      attachment.bytes ??
      (await this.evidence.readAttachmentBytes(attachment));
    if (!bytes || bytes.byteLength === 0) {
      throw new EvidenceNotFoundError(attachmentId);
    }
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      bytes,
    };
  }

  private async requireCase(caseId: string): Promise<void> {
    const record = await this.cases.getCaseById(caseId);
    if (!record) {
      throw new CaseNotFoundError(caseId);
    }
  }

  private async withPreviewUrls(
    item: TechnicalEvidenceRecord,
  ): Promise<TechnicalEvidenceRecord> {
    // App route enforces case ownership on every image request.
    const attachments = item.attachments.map((attachment) => ({
      ...attachment,
      previewUrl: `/api/cases/${item.caseId}/evidence/attachments/${attachment.id}`,
    }));
    return { ...item, attachments };
  }
}
