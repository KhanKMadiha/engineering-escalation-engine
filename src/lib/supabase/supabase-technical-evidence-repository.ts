import "server-only";

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
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/supabase/errors";

type EvidenceRow = {
  id: string;
  case_id: string;
  evidence_type: TechnicalEvidenceRecord["evidenceType"];
  title: string;
  service: string | null;
  body: string | null;
  caption: string | null;
  captured_at: string | null;
  request_id: string | null;
  trace_id: string | null;
  external_url: string | null;
  source: TechnicalEvidenceRecord["source"];
  verification_status: TechnicalEvidenceRecord["verificationStatus"];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  evidence_id: string;
  storage_path: string;
  file_name: string;
  content_type: TechnicalEvidenceAttachment["contentType"];
  byte_size: number;
  width_px: number | null;
  height_px: number | null;
  checksum_sha256: string | null;
  created_at: string;
};

function mapAttachment(row: AttachmentRow): TechnicalEvidenceAttachment {
  return {
    id: row.id,
    evidenceId: row.evidence_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    widthPx: row.width_px,
    heightPx: row.height_px,
    checksumSha256: row.checksum_sha256,
    createdAt: row.created_at,
  };
}

function mapEvidence(
  row: EvidenceRow,
  attachments: TechnicalEvidenceAttachment[],
): TechnicalEvidenceRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    evidenceType: row.evidence_type,
    title: row.title,
    service: row.service,
    body: row.body,
    caption: row.caption,
    capturedAt: row.captured_at,
    requestId: row.request_id,
    traceId: row.trace_id,
    externalUrl: row.external_url,
    source: row.source,
    verificationStatus: row.verification_status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments,
  };
}

export class SupabaseTechnicalEvidenceRepository
  implements TechnicalEvidenceRepository
{
  private client = getSupabaseServerClient();

  async listByCaseId(caseId: string): Promise<TechnicalEvidenceRecord[]> {
    const { data, error } = await this.client
      .from("case_technical_evidence")
      .select("*")
      .eq("case_id", caseId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    const rows = (data ?? []) as EvidenceRow[];
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const { data: attachmentData, error: attachmentError } = await this.client
      .from("case_technical_evidence_attachments")
      .select("*")
      .in("evidence_id", ids);
    if (attachmentError) {
      throw mapSupabaseError(attachmentError, "technical_evidence.attachments");
    }
    const attachments = ((attachmentData ?? []) as AttachmentRow[]).map(
      mapAttachment,
    );
    return rows.map((row) =>
      mapEvidence(
        row,
        attachments.filter((item) => item.evidenceId === row.id),
      ),
    );
  }

  async getById(evidenceId: string): Promise<TechnicalEvidenceRecord | null> {
    const { data, error } = await this.client
      .from("case_technical_evidence")
      .select("*")
      .eq("id", evidenceId)
      .maybeSingle();
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    if (!data) {
      return null;
    }
    const row = data as EvidenceRow;
    const { data: attachmentData, error: attachmentError } = await this.client
      .from("case_technical_evidence_attachments")
      .select("*")
      .eq("evidence_id", evidenceId);
    if (attachmentError) {
      throw mapSupabaseError(attachmentError, "technical_evidence.attachments");
    }
    return mapEvidence(
      row,
      ((attachmentData ?? []) as AttachmentRow[]).map(mapAttachment),
    );
  }

  async create(
    input: CreateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const { data, error } = await this.client
      .from("case_technical_evidence")
      .insert({
        id,
        case_id: input.caseId,
        evidence_type: input.evidenceType,
        title: input.title.trim(),
        service: input.service?.trim() || null,
        body: input.body?.trim() || null,
        caption: input.caption?.trim() || null,
        captured_at: input.capturedAt ?? null,
        request_id: input.requestId?.trim() || null,
        trace_id: input.traceId?.trim() || null,
        external_url: input.externalUrl?.trim() || null,
        source: input.source,
        verification_status:
          input.verificationStatus ??
          (input.source === "demo_fictional" ? "demo_fictional" : "recorded"),
        sort_order: input.sortOrder ?? 0,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    return mapEvidence(data as EvidenceRow, []);
  }

  async update(
    evidenceId: string,
    input: UpdateTechnicalEvidenceInput,
  ): Promise<TechnicalEvidenceRecord> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.evidenceType !== undefined) patch.evidence_type = input.evidenceType;
    if (input.service !== undefined) {
      patch.service = input.service?.trim() || null;
    }
    if (input.body !== undefined) patch.body = input.body?.trim() || null;
    if (input.caption !== undefined) {
      patch.caption = input.caption?.trim() || null;
    }
    if (input.capturedAt !== undefined) patch.captured_at = input.capturedAt;
    if (input.requestId !== undefined) {
      patch.request_id = input.requestId?.trim() || null;
    }
    if (input.traceId !== undefined) {
      patch.trace_id = input.traceId?.trim() || null;
    }
    if (input.externalUrl !== undefined) {
      patch.external_url = input.externalUrl?.trim() || null;
    }
    if (input.source !== undefined) patch.source = input.source;
    if (input.verificationStatus !== undefined) {
      patch.verification_status = input.verificationStatus;
    }
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

    const { error } = await this.client
      .from("case_technical_evidence")
      .update(patch)
      .eq("id", evidenceId);
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    const updated = await this.getById(evidenceId);
    if (!updated) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    return updated;
  }

  async delete(evidenceId: string): Promise<void> {
    const existing = await this.getById(evidenceId);
    if (!existing) {
      return;
    }
    for (const attachment of existing.attachments) {
      await this.client.storage
        .from("case-evidence")
        .remove([attachment.storagePath]);
    }
    const { error } = await this.client
      .from("case_technical_evidence")
      .delete()
      .eq("id", evidenceId);
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
  }

  async addAttachment(
    input: CreateAttachmentInput,
  ): Promise<TechnicalEvidenceAttachment> {
    if (input.bytes) {
      const { error: uploadError } = await this.client.storage
        .from("case-evidence")
        .upload(input.storagePath, input.bytes, {
          contentType: input.contentType,
          upsert: false,
        });
      if (uploadError) {
        throw mapSupabaseError(uploadError, "technical_evidence.storage");
      }
    }

    const id = crypto.randomUUID();
    const { data, error } = await this.client
      .from("case_technical_evidence_attachments")
      .insert({
        id,
        evidence_id: input.evidenceId,
        storage_path: input.storagePath,
        file_name: input.fileName,
        content_type: input.contentType,
        byte_size: input.byteSize,
        width_px: input.widthPx ?? null,
        height_px: input.heightPx ?? null,
        checksum_sha256: input.checksumSha256 ?? null,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    await this.client
      .from("case_technical_evidence")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.evidenceId);
    return mapAttachment(data as AttachmentRow);
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.getAttachment(attachmentId);
    if (!attachment) {
      return;
    }
    await this.client.storage
      .from("case-evidence")
      .remove([attachment.storagePath]);
    const { error } = await this.client
      .from("case_technical_evidence_attachments")
      .delete()
      .eq("id", attachmentId);
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
  }

  async getAttachment(
    attachmentId: string,
  ): Promise<(TechnicalEvidenceAttachment & { bytes?: Uint8Array }) | null> {
    const { data, error } = await this.client
      .from("case_technical_evidence_attachments")
      .select("*")
      .eq("id", attachmentId)
      .maybeSingle();
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    if (!data) {
      return null;
    }
    return mapAttachment(data as AttachmentRow);
  }

  async readAttachmentBytes(
    attachment: TechnicalEvidenceAttachment,
  ): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage
      .from("case-evidence")
      .download(attachment.storagePath);
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    if (!data) {
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async createPreviewUrl(
    attachment: TechnicalEvidenceAttachment,
    expiresInSeconds = 120,
  ): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from("case-evidence")
      .createSignedUrl(attachment.storagePath, expiresInSeconds);
    if (error) {
      throw mapSupabaseError(error, "technical_evidence");
    }
    return data.signedUrl;
  }
}

export function createSupabaseTechnicalEvidenceRepository(): SupabaseTechnicalEvidenceRepository {
  return new SupabaseTechnicalEvidenceRepository();
}
