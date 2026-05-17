// Upload route for report attachments. Receives multipart/form-data with a
// reportId string and a file blob, converts the bytes to a Buffer, and
// delegates to AddReportAttachmentUseCase which enforces the Draft-state guard,
// the 20-attachment count cap, and the magic-byte / mime / size validations.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AddReportAttachmentUseCase } from '@/application/report/AddReportAttachmentUseCase';

const reportRepo = new PrismaReportRepository(prisma);
const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const uc = new AddReportAttachmentUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  attachmentRepo
);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const reportId = form.get('reportId');
  const file = form.get('file');

  if (
    typeof reportId !== 'string' ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const result = await uc.execute({
    reportId,
    callerId: user.id,
    fileName: file.name,
    mimeType: file.type,
    bytes,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // result.value is { id: string }
  return NextResponse.json(result.value);
}
