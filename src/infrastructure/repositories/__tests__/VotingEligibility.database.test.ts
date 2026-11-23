/** Verify real authorization, concurrent retries and durable history through the membership service. */
import { expect, it } from 'vitest';
import { pollDatabase } from './pollDatabase';
import { PrismaVotingEligibilityStore } from '../PrismaVotingEligibilityStore';
import { VotingEligibility } from '@/application/organization/VotingEligibility';
import { UserId } from '@/domain/shared/EntityIds';

it('audits org-admin and superadmin changes once and keeps them after member removal', async () => {
  const db = await pollDatabase();

  try {
    const people = ['admin', 'super', 'member', 'outside'].map((id) =>
      UserId.parse(id)
    );
    const [admin, superadmin, member, outside] = people;
    await db.prisma.user.createMany({
      data: people.map((id, i) => ({
        id,
        firstName: id,
        lastName: 'Test',
        phoneNumber: '+1555555010' + i,
        nickname: 'user_' + id,
        password: 'fixture',
      })),
    });
    await db.prisma.organization.createMany({
      data: ['org', 'other'].map((id) => ({
        id,
        name: id,
        description: '',
        createdById: admin,
      })),
    });
    await db.prisma.organizationAdminUser.createMany({
      data: [
        { userId: admin, organizationId: 'org' },
        { userId: outside, organizationId: 'other' },
      ],
    });
    await db.prisma.superAdmin.create({ data: { userId: superadmin } });
    await db.prisma.organizationUser.create({
      data: { organizationId: 'org', userId: member, status: 'accepted' },
    });
    const service = new VotingEligibility(
      new PrismaVotingEligibilityStore(db.prisma)
    );
    const change = {
      organizationId: 'org',
      memberId: member,
      eligible: false,
      reason: '  Board decision  ',
    };

    for (const actor of [member, outside]) {
      expect((await service.change(actor, change)).success).toBe(false);
      expect(
        (await service.history(actor, { organizationId: 'org' })).success
      ).toBe(false);
    }

    expect(
      (
        await Promise.all([
          service.change(admin, change),
          service.change(admin, change),
        ])
      ).every((r) => r.success)
    ).toBe(true);
    expect(
      await db.prisma.organizationUser.findFirstOrThrow({
        where: { userId: member },
      })
    ).toMatchObject({ votingEligible: false });
    const restored = {
      ...change,
      eligible: true,
      reason: 'Eligibility restored',
    };
    expect(
      (await service.change(superadmin, { ...restored, reason: ' ' })).success
    ).toBe(false);
    expect((await service.change(superadmin, restored)).success).toBe(true);
    await db.prisma.organizationUser.deleteMany({ where: { userId: member } });
    expect((await service.change(admin, change)).success).toBe(false);

    for (const actor of [admin, superadmin]) {
      const result = await service.history(actor, { organizationId: 'org' });
      expect(result).toMatchObject({
        success: true,
        value: {
          entries: [
            {
              actorNickname: 'user_super',
              memberNickname: 'user_member',
              wasEligible: false,
              eligible: true,
              reason: 'Eligibility restored',
              changedAt: expect.any(String),
            },
            {
              actorNickname: 'user_admin',
              wasEligible: true,
              eligible: false,
              reason: 'Board decision',
            },
          ],
          next: null,
        },
      });
    }
  } finally {
    await db.close();
  }
}, 30000);
