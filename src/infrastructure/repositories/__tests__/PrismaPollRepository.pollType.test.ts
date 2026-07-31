import { describe, it, expect, vi } from 'vitest';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { Poll } from '@/domain/poll/Poll';

function makeOpenPoll(): Poll {
  const result = Poll.create(
    'Open Poll',
    'Everyone may vote',
    'org-1',
    null,
    'user-1',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    'OPEN'
  );

  return result.value;
}

function prismaRow(pollType: string) {
  return {
    id: 'poll-1',
    title: 'Open Poll',
    description: 'Everyone may vote',
    organizationId: 'org-1',
    boardId: null,
    pollType,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-02-01'),
    state: 'DRAFT',
    weightCriteria: null,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    archivedAt: null,
    questions: [],
    properties: [],
  };
}

describe('PrismaPollRepository poll type mapping', () => {
  it('writes poll_type on create', async () => {
    const create = vi.fn().mockResolvedValue(prismaRow('OPEN'));
    const prisma = { poll: { create } } as any;
    const repository = new PrismaPollRepository(prisma);

    const result = await repository.createPoll(makeOpenPoll());

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pollType: 'OPEN' }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.value.isOpen()).toBe(true);
  });

  it('reconstitutes pollType from the row on read', async () => {
    const findUnique = vi.fn().mockResolvedValue(prismaRow('OPEN'));
    const prisma = { poll: { findUnique } } as any;
    const repository = new PrismaPollRepository(prisma);

    const result = await repository.getPollById('poll-1');

    expect(result.success).toBe(true);
    expect(result.value!.isOpen()).toBe(true);
    expect(result.value!.pollType).toBe('OPEN');
  });

  it('reads existing rows as ORGANIZATION polls', async () => {
    const findUnique = vi.fn().mockResolvedValue(prismaRow('ORGANIZATION'));
    const prisma = { poll: { findUnique } } as any;
    const repository = new PrismaPollRepository(prisma);

    const result = await repository.getPollById('poll-1');

    expect(result.success).toBe(true);
    expect(result.value!.isOpen()).toBe(false);
    expect(result.value!.pollType).toBe('ORGANIZATION');
  });

  it('writes poll_type on update', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { poll: { update } } as any;
    const repository = new PrismaPollRepository(prisma);

    const poll = makeOpenPoll();
    (poll as any).props.id = 'poll-1';

    const result = await repository.updatePoll(poll);

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pollType: 'OPEN' }),
      })
    );
  });
});
