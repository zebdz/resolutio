/** Resolve live and sealed file disclosure using the current download permissions. */
import { ResolvePollAttachmentVisibilityService } from '@/application/poll/ResolvePollAttachmentVisibilityService';
import {
  BoardId,
  OrganizationId,
  PollId,
  UserId,
} from '@/domain/shared/EntityIds';
import type { PrismaClient } from '@/generated/prisma/client';
import { PrismaBoardRepository } from './PrismaBoardRepository';
import { PrismaOrganizationRepository } from './PrismaOrganizationRepository';
import { PrismaUserRepository } from './PrismaUserRepository';

export async function canReadPollFiles(
  db: PrismaClient,
  pollId: PollId,
  viewer: UserId
) {
  const acl = await db.poll.findUnique({
    where: { id: pollId },
    select: {
      createdBy: true,
      organizationId: true,
      boardId: true,
      state: true,
      archivedAt: true,
      pollType: true,
    },
  });

  if (!acl) {
    return false;
  }

  const visibility = new ResolvePollAttachmentVisibilityService(
    new PrismaOrganizationRepository(db),
    new PrismaBoardRepository(db),
    new PrismaUserRepository(db)
  );

  return visibility.canRead(
    {
      createdBy: UserId.parse(acl.createdBy),
      organizationId: OrganizationId.parse(acl.organizationId),
      boardId: BoardId.nullable().parse(acl.boardId),
      isDraft: () => acl.state === 'DRAFT',
      isArchived: () => acl.archivedAt !== null,
      isOpen: () => acl.pollType === 'OPEN',
    },
    viewer
  );
}
