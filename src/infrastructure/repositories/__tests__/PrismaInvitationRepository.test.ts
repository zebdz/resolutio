/** Invitation persistence retains identity assigned before the aggregate exists.
 * Mapping delegates validation of persisted target/lifecycle data to the domain. */
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { Invitation } from '@/domain/invitation/Invitation';
import {
  InvitationId,
  OrganizationId,
  UserId,
} from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaInvitationRepository } from '../PrismaInvitationRepository';

it('saves the assigned invitation identity', async () => {
  const invitation = Invitation.create(
    OrganizationId.parse('org-1'),
    UserId.parse('u-1'),
    UserId.parse('u-2'),
    { type: 'admin_invite', boardId: null },
    testCreation(InvitationId, 'assigned-invite')
  );
  const prisma = {
    invitation: {
      create: vi.fn(async ({ data }) => ({ id: 'db-default', ...data })),
    },
  } as unknown as PrismaClient;
  const saved = await new PrismaInvitationRepository(prisma).save(invitation);
  expect(saved.id).toBe(invitation.id);
  expect(saved.createdAt).toEqual(invitation.createdAt);
});
