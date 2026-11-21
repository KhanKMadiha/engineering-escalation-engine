import { NextResponse } from "next/server";
import {
  EvidenceAccessError,
  EvidenceNotFoundError,
} from "@/lib/evidence/evidence-service";
import { getEvidenceService } from "@/lib/evidence/get-evidence-service";
import { CaseNotFoundError } from "@/lib/cases/case-service";
import { logOperationalError } from "@/lib/security/safe-log";

const CASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteParams = {
  params: Promise<{ caseId: string; attachmentId: string }>;
};

/**
 * Private evidence screenshot download.
 * Verifies the attachment belongs to the given case before streaming bytes.
 * Does not expose permanent public storage URLs.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { caseId, attachmentId } = await params;
  if (!CASE_ID_PATTERN.test(caseId) || !CASE_ID_PATTERN.test(attachmentId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await getEvidenceService().downloadAttachmentForCase(
      caseId,
      attachmentId,
    );
    return new NextResponse(Buffer.from(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `inline; filename="${sanitizeFileName(file.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof CaseNotFoundError ||
      error instanceof EvidenceNotFoundError ||
      error instanceof EvidenceAccessError
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logOperationalError("evidenceAttachmentDownload", {
      event: "technical_evidence_attachment_download_failed",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Unable to load attachment" }, { status: 500 });
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "screenshot";
}
