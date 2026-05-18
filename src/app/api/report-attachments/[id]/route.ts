// Visibility-checked download route for report attachments. Auth is optional —
// public-anon reports are readable without a session. Forbidden / missing reads
// collapse to 404 to avoid leaking whether an attachment id exists.
//
// Why inline not attachment? Reports are documents the user wants to read in
// the browser (PDF, images); inline triggers the native viewer rather than
// forcing a save-dialog. RFC 5987 filename encoding keeps non-ASCII names
// (Russian etc.) intact.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { ReportVisibility } from '@/domain/report/ReportVisibility';

const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const reportRepo = new PrismaReportRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const visibilitySvc = new ResolveReportVisibilityService(
  orgRepo,
  boardRepo,
  userRepo
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Metadata first: lightweight, no bytes yet.
  const metaR = await attachmentRepo.findById(id);

  if (!metaR.success || !metaR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const meta = metaR.value;

  const reportR = await reportRepo.findByIdWithRelations(meta.reportId);

  if (!reportR.success || !reportR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const report = reportR.value;

  // Auth is optional: public-anon reports need no session.
  const viewer = await getCurrentUser();
  const canRead = await visibilitySvc.canRead(report, viewer?.id ?? null);

  if (!canRead) {
    // Collapse forbidden + not-found into the same 404 to avoid existence leaks.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const bytesR = await attachmentRepo.findBytesById(id);

  if (!bytesR.success || !bytesR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { fileName, mimeType, bytes } = bytesR.value;

  // RFC 5987 encoding: encodeURIComponent percent-encodes everything except
  // unreserved chars; we also escape single-quote, parens which are not
  // safe inside the ext-value token.
  const encoded = encodeURIComponent(fileName).replace(
    /['()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

  const isPublicAnon = report.visibility === ReportVisibility.PUBLIC_ANON;

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
      'Cache-Control': isPublicAnon
        ? 'public, max-age=300'
        : 'private, no-store',
    },
  });
}
