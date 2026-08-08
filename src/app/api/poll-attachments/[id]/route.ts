// Visibility-checked download route for poll description attachments. Auth is
// optional — live open polls are readable without a session. Forbidden and
// missing reads collapse to the same 404 so attachment existence cannot be
// probed.
//
// This route is the ONLY way to reach an attachment's bytes. Files are never
// written to disk, so nginx's static-file location block cannot serve them
// and bypass this check.
//
// Response headers — including which types may render inline and which are
// forced to download — are built by buildAttachmentResponseHeaders. Images
// are inline so they appear inside the description; PDFs download, because a
// PDF rendered inline on this cookie-bearing origin is a script-execution
// surface via the browser's PDF viewer, and polls link to PDFs rather than
// embedding them.
//
// Deliberately not rate-limited: a description with 20 images issues 20 GETs
// per page view, so limiting reads would break rendering.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaPollRepository,
  PrismaPollAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { ResolvePollAttachmentVisibilityService } from '@/application/poll/ResolvePollAttachmentVisibilityService';
import { buildAttachmentResponseHeaders } from '@/web/lib/attachmentResponseHeaders';

const attachmentRepo = new PrismaPollAttachmentRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const visibilitySvc = new ResolvePollAttachmentVisibilityService(
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

  const pollR = await pollRepo.getPollById(metaR.value.pollId);

  if (!pollR.success || !pollR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const poll = pollR.value;

  // Auth is optional: live open polls need no session.
  const viewer = await getCurrentUser();
  const canRead = await visibilitySvc.canRead(poll, viewer?.id ?? null);

  if (!canRead) {
    // Collapse forbidden and not-found into the same response so the
    // existence of an attachment id cannot be probed.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const bytesR = await attachmentRepo.findBytesById(id);

  if (!bytesR.success || !bytesR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { fileName, mimeType, bytes } = bytesR.value;

  // Only a live open poll may be cached by shared caches; everything else is
  // access-controlled per viewer and must not be stored.
  const isPubliclyReadable =
    poll.isOpen() && !poll.isDraft() && !poll.isArchived();

  return new Response(new Uint8Array(bytes), {
    headers: buildAttachmentResponseHeaders({
      fileName,
      mimeType,
      publiclyReadable: isPubliclyReadable,
    }),
  });
}
