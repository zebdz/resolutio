// Upload route for poll description attachments. Receives multipart/form-data
// with a pollId string and a file blob, converts the bytes to a Buffer, and
// delegates to AddPollAttachmentUseCase which enforces authorization, the
// DRAFT/READY-only guard, the 20-attachment count cap, and the magic-byte /
// mime / size validations.
//
// Rate-limited because each call accepts up to 10 MB. The matching GET route
// deliberately is not: a description with 20 images issues 20 GETs per page
// view, so limiting reads would break rendering.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import {
  prisma,
  PrismaPollRepository,
  PrismaPollAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AddPollAttachmentUseCase } from '@/application/poll/AddPollAttachmentUseCase';

const pollRepo = new PrismaPollRepository(prisma);
const attachmentRepo = new PrismaPollAttachmentRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const uc = new AddPollAttachmentUseCase(
  pollRepo,
  orgRepo,
  userRepo,
  attachmentRepo
);

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json({ error: rateLimited.error }, { status: 429 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const pollId = form.get('pollId');
  const file = form.get('file');

  if (
    typeof pollId !== 'string' ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const result = await uc.execute({
    pollId,
    callerId: user.id,
    fileName: file.name,
    mimeType: file.type,
    bytes,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: await translateErrorCode(result.error) },
      { status: 400 }
    );
  }

  return NextResponse.json({ id: result.value.id });
}
