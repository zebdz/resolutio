/** Persistence must keep the identity/time assigned before aggregate creation.
 * Database defaults must not replace values used by callers and domain events. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Poll } from '@/domain/poll/Poll';
import { PollId, OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaPollRepository } from '../PrismaPollRepository';

it('persists the assigned poll identity and creation instant', async () => {
  const result = Poll.create(
    PollTitle.parse('Poll'),
    PollDescription.parse('Description'),
    OrganizationId.parse('org-1'),
    null,
    UserId.parse('user-1'),
    expectSuccess(
      PollPeriod.create(new Date('2026-02-01'), new Date('2026-03-01'))
    ),
    testCreation(PollId, 'assigned-poll')
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const poll = result.value;
  const prisma = {
    poll: {
      create: vi.fn(async ({ data }: Prisma.PollCreateArgs) => ({
        ...poll.toJSON(),
        id: 'db-default-id',
        createdAt: new Date('2030-01-01'),
        ...data,
        properties: [],
        attachments: [],
        questions: [],
      })),
    },
  } as unknown as PrismaClient;
  const saved = await new PrismaPollRepository(prisma).createPoll(poll);
  expect(saved.success).toBe(true);

  if (!saved.success) {
    throw new Error(saved.error);
  }

  expect(saved.value.id).toBe(poll.id);
  expect(saved.value.createdAt).toEqual(poll.createdAt);
});
