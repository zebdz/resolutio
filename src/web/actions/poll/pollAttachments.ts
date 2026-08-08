'use server';

import { checkRateLimit } from '@/web/actions/rateLimit';
import { getCurrentUser } from '@/web/lib/session';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import {
  prisma,
  PrismaPollRepository,
  PrismaPollAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { ResolvePollAttachmentVisibilityService } from '@/application/poll/ResolvePollAttachmentVisibilityService';
import { RemovePollAttachmentUseCase } from '@/application/poll/RemovePollAttachmentUseCase';

const pollRepo = new PrismaPollRepository(prisma);
const attachmentRepo = new PrismaPollAttachmentRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const visibilitySvc = new ResolvePollAttachmentVisibilityService(
  orgRepo,
  boardRepo,
  userRepo
);

const removeUseCase = new RemovePollAttachmentUseCase(
  pollRepo,
  orgRepo,
  userRepo,
  attachmentRepo
);

/** Metadata only — file bytes never cross to a Client Component. */
export interface PollAttachmentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function listPollAttachmentsAction(
  pollId: string
): Promise<ActionResult<PollAttachmentSummary[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return { success: false, error: rateLimited.error };
  }

  const user = await getCurrentUser();

  const pollResult = await pollRepo.getPollById(pollId);

  if (!pollResult.success || !pollResult.value) {
    return {
      success: false,
      error: await translateErrorCode('poll.errors.pollNotFound'),
    };
  }

  // Same rule as the download route: seeing the file list is seeing part of
  // the description, so it must not be more permissive than reading the poll.
  const canRead = await visibilitySvc.canRead(
    pollResult.value,
    user?.id ?? null
  );

  if (!canRead) {
    return {
      success: false,
      error: await translateErrorCode('poll.errors.pollNotFound'),
    };
  }

  const result = await attachmentRepo.findByPollId(pollId);

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return {
    success: true,
    data: result.value.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  };
}

export async function removePollAttachmentAction(
  attachmentId: string
): Promise<ActionResult<null>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return { success: false, error: rateLimited.error };
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: await translateErrorCode('auth.errors.unauthorized'),
    };
  }

  const result = await removeUseCase.execute({
    attachmentId,
    callerId: user.id,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: null };
}
