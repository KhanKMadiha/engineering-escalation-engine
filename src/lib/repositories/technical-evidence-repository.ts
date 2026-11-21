import type {
  CreateTechnicalEvidenceInput,
  TechnicalEvidenceAttachment,
  TechnicalEvidenceRecord,
  UpdateTechnicalEvidenceInput,
} from "@/lib/evidence/evidence-types";

export type CreateAttachmentInput = {
  evidenceId: string;
  storagePath: string;
  fileName: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  widthPx?: number | null;
  heightPx?: number | null;
  checksumSha256?: string | null;
  /** In-memory only: raw bytes for local/demo preview. */
  bytes?: Uint8Array;
};

/**
 * Persistence boundary for Phase B technical evidence.
 * Independent of case_analyses / AI reassessment.
 */
export interface TechnicalEvidenceRepository {
  listByCaseId(caseId: string): Promise<TechnicalEvidenceRecord[]>;
  getById(evidenceId: string): Promise<TechnicalEvidenceRecord | null>;
  create(input: CreateTechnicalEvidenceInput): Promise<TechnicalEvidenceRecord>;
  update(
    evidenceId: string,
    input: UpdateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord>;
  delete(evidenceId: string): Promise<void>;
  addAttachment(
    input: CreateAttachmentInput,
  ): Promise<TechnicalEvidenceAttachment>;
  deleteAttachment(attachmentId: string): Promise<void>;
  getAttachment(
    attachmentId: string,
  ): Promise<(TechnicalEvidenceAttachment & { bytes?: Uint8Array }) | null>;
  /** Read file bytes for authorised download (memory store or private bucket). */
  readAttachmentBytes(
    attachment: TechnicalEvidenceAttachment,
  ): Promise<Uint8Array | null>;
  /**
   * Optional short-lived signed URL. Prefer app download routes for authz.
   */
  createPreviewUrl(
    attachment: TechnicalEvidenceAttachment,
    expiresInSeconds?: number,
  ): Promise<string | null>;
}
