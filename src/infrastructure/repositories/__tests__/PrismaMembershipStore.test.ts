/** Membership storage preserves renewal metadata semantics and validates status reads.
 * Tests use the public adapter with an isolated fake ORM boundary. */
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  MembershipReference,
  requestMembership,
  decideMembershipRequest,
  acceptInvitedMembership,
} from '@/domain/organization/MembershipPolicy';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PrismaMembershipStore } from '../PrismaMembershipStore';

const reference = MembershipReference.parse({
  organizationId: 'org',
  userId: 'user',
});
const now = Instant.parse('2026-10-30T12:00:00.000Z');

it('decodes status and persists new versus renewed requests without rewriting the original request date', async () => {
  const findUnique = vi.fn().mockResolvedValue({ status: 'rejected' });
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const store = new PrismaMembershipStore({
    organizationUser: { findUnique, create, update },
  } as unknown as PrismaClient);
  expect(expectSuccess(await store.findStatus(reference))).toBe('rejected');
  expect(
    await store.saveRequest(
      reference,
      expectSuccess(requestMembership(null, null, now))
    )
  ).toEqual({ success: true, value: undefined });
  expect(create).toHaveBeenCalledWith({
    data: {
      organizationId: 'org',
      userId: 'user',
      status: 'pending',
      createdAt: new Date(now),
      joinTokenId: null,
    },
  });
  expect(
    await store.saveRequest(
      reference,
      expectSuccess(requestMembership('rejected', null, now))
    )
  ).toEqual({ success: true, value: undefined });
  expect(update).toHaveBeenCalledWith({
    where: { organizationId_userId: { organizationId: 'org', userId: 'user' } },
    data: {
      status: 'pending',
      rejectedAt: null,
      rejectedByUserId: null,
      rejectionReason: null,
      joinTokenId: null,
    },
  });
  findUnique.mockResolvedValue({ status: 'unknown' });
  expect(await store.findStatus(reference)).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});

it('persists decision variants and uses one supplied instant in both invitation upsert branches', async () => {
  const update = vi.fn().mockResolvedValue({});
  const upsert = vi.fn().mockResolvedValue({});
  const store = new PrismaMembershipStore({
    organizationUser: { update, upsert },
  } as unknown as PrismaClient);
  const actor = UserId.parse('admin');
  const decision = expectSuccess(
    decideMembershipRequest(
      'pending',
      { action: 'reject', reason: null },
      actor,
      now
    )
  );
  expect(await store.saveDecision(reference, decision)).toEqual({
    success: true,
    value: undefined,
  });
  expect(update).toHaveBeenCalledWith({
    where: { organizationId_userId: reference },
    data: {
      status: 'rejected',
      rejectedAt: new Date(now),
      rejectedByUserId: 'admin',
      rejectionReason: null,
    },
  });
  expect(
    await store.acceptInvitation(reference, acceptInvitedMembership(actor, now))
  ).toEqual({ success: true, value: undefined });
  expect(upsert).toHaveBeenCalledWith({
    where: { organizationId_userId: reference },
    create: {
      organizationId: 'org',
      userId: 'user',
      status: 'accepted',
      createdAt: new Date(now),
      acceptedAt: new Date(now),
      acceptedByUserId: 'admin',
    },
    update: {
      status: 'accepted',
      acceptedAt: new Date(now),
      acceptedByUserId: 'admin',
    },
  });
});
