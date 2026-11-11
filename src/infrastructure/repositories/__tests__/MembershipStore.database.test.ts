/** PostgreSQL acceptance tests for typed membership persistence: renewals keep row
 * identity/request time, and invitation upserts preserve previous rejection metadata. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MembershipReference,
  MembershipRejectionReason,
  requestMembership,
  decideMembershipRequest,
  acceptInvitedMembership,
} from '@/domain/organization/MembershipPolicy';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PrismaMembershipStore } from '../PrismaMembershipStore';
import { pollDatabase } from './pollDatabase';

const requestedAt = Instant.parse('2026-01-01T00:00:00.000Z');
const rejectedAt = Instant.parse('2026-01-02T00:00:00.000Z');
const acceptedAt = Instant.parse('2026-01-03T00:00:00.000Z');

describe('membership transition persistence', () => {
  let db: Awaited<ReturnType<typeof pollDatabase>>;
  beforeAll(async () => {
    db = await pollDatabase();
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });

  async function fixture() {
    const stamp = crypto.randomUUID();
    const user = await db.prisma.user.create({
      data: {
        firstName: 'Alice',
        lastName: 'Smith',
        phoneNumber: stamp,
        nickname: `u${stamp.replaceAll('-', '').slice(0, 20)}`,
        password: 'test',
      },
    });
    const org = await db.prisma.organization.create({
      data: { name: stamp, description: 'Test', createdById: user.id },
    });
    const reference = MembershipReference.parse({
      organizationId: org.id,
      userId: user.id,
    });
    const actor = UserId.parse(user.id);
    const store = new PrismaMembershipStore(db.prisma);
    expectSuccess(
      await store.saveRequest(
        reference,
        expectSuccess(requestMembership(null, null, requestedAt))
      )
    );
    const reason = MembershipRejectionReason.parse('Missing documents');
    expectSuccess(
      await store.saveDecision(
        reference,
        expectSuccess(
          decideMembershipRequest(
            'pending',
            { action: 'reject', reason },
            actor,
            rejectedAt
          )
        )
      )
    );
    const row = () =>
      db.prisma.organizationUser.findUniqueOrThrow({
        where: { organizationId_userId: reference },
      });

    return { store, reference, actor, row };
  }

  it('renews a rejected request without changing row identity or its original request date', async () => {
    const { store, reference, row } = await fixture();
    const original = await row();
    const status = expectSuccess(await store.findStatus(reference));
    expectSuccess(
      await store.saveRequest(
        reference,
        expectSuccess(requestMembership(status, null, acceptedAt))
      )
    );
    expect(await row()).toMatchObject({
      id: original.id,
      status: 'pending',
      createdAt: new Date(requestedAt),
      rejectedAt: null,
      rejectedByUserId: null,
      rejectionReason: null,
    });
  });

  it('accepts invitations with the supplied instant while preserving existing rejection history', async () => {
    const { store, reference, actor, row } = await fixture();
    const original = await row();
    expectSuccess(
      await store.acceptInvitation(
        reference,
        acceptInvitedMembership(actor, acceptedAt)
      )
    );
    expect(await row()).toMatchObject({
      id: original.id,
      status: 'accepted',
      createdAt: new Date(requestedAt),
      acceptedAt: new Date(acceptedAt),
      acceptedByUserId: actor,
      rejectedAt: new Date(rejectedAt),
      rejectedByUserId: actor,
      rejectionReason: 'Missing documents',
    });
  });
});
