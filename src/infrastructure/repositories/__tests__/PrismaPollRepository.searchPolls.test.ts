import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { PollState } from '../../../domain/poll/PollState';

// --- Mock Prisma client ---

function createMockPrisma() {
  return {
    poll: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

// --- Helpers ---

const now = new Date('2025-06-01T00:00:00Z');
const startDate = new Date('2025-07-01T00:00:00Z');
const endDate = new Date('2025-08-01T00:00:00Z');

function buildPrismaPoll(overrides: Record<string, any> = {}) {
  return {
    id: 'poll-1',
    title: 'Test Poll',
    description: 'A test poll description',
    organizationId: 'org-1',
    boardId: 'board-1',
    createdBy: 'user-1',
    startDate,
    endDate,
    state: 'DRAFT' as const,
    weightCriteria: null,
    createdAt: now,
    archivedAt: null,
    questions: [],
    ...overrides,
  };
}

describe('PrismaPollRepository.searchPolls', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let repo: PrismaPollRepository;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repo = new PrismaPollRepository(mockPrisma as any);
  });

  it('should return all non-archived polls when no filters', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([buildPrismaPoll()]);

    const result = await repo.searchPolls({});

    expect(result.success).toBe(true);
    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
        }),
      })
    );

    if (!result.success) {return;}

    expect(result.value).toHaveLength(1);
    expect(result.value[0].id).toBe('poll-1');
  });

  it('should filter by titleSearch using contains insensitive', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([buildPrismaPoll()]);

    await repo.searchPolls({ titleSearch: 'Test' });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: 'Test', mode: 'insensitive' },
        }),
      })
    );
  });

  it('should filter by statuses using in clause', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({
      statuses: [PollState.DRAFT, PollState.ACTIVE],
    });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: { in: ['DRAFT', 'ACTIVE'] },
        }),
      })
    );
  });

  it('should filter by organizationId', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({ organizationId: 'org-1' });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
        }),
      })
    );
  });

  it('should filter by boardId', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({ boardId: 'board-1' });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          boardId: 'board-1',
        }),
      })
    );
  });

  it('should filter by createdFrom/createdTo', async () => {
    const from = new Date('2025-01-01');
    const to = new Date('2025-06-01');
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({ createdFrom: from, createdTo: to });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: from, lte: to },
        }),
      })
    );
  });

  it('should filter by createdFrom only', async () => {
    const from = new Date('2025-01-01');
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({ createdFrom: from });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: from },
        }),
      })
    );
  });

  it('should filter by startFrom/startTo', async () => {
    const from = new Date('2025-07-01');
    const to = new Date('2025-08-01');
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({ startFrom: from, startTo: to });

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startDate: { gte: from, lte: to },
        }),
      })
    );
  });

  it('should add membership WHERE clause when userId provided', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({}, 'user-1');

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              organization: {
                members: {
                  some: { userId: 'user-1', status: 'accepted' },
                },
              },
            },
            {
              board: {
                members: {
                  some: { userId: 'user-1', removedAt: null },
                },
              },
            },
            {
              participants: {
                some: { userId: 'user-1' },
              },
            },
          ],
        }),
      })
    );
  });

  it('should add admin org IDs to OR clause when provided with userId', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({}, 'user-1', ['org-admin-1', 'org-admin-2']);

    const call = mockPrisma.poll.findMany.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(4);
    expect(call.where.OR[3]).toEqual({
      organizationId: { in: ['org-admin-1', 'org-admin-2'] },
    });
  });

  it('should not add admin org clause when adminOrgIds is empty', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({}, 'user-1', []);

    const call = mockPrisma.poll.findMany.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(3);
  });

  it('should NOT add membership clause when userId omitted (superadmin)', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({});

    const call = mockPrisma.poll.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });

  it('should combine multiple filters', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls(
      {
        titleSearch: 'Budget',
        statuses: [PollState.ACTIVE],
        organizationId: 'org-2',
      },
      'user-1'
    );

    const call = mockPrisma.poll.findMany.mock.calls[0][0];
    expect(call.where.title).toEqual({
      contains: 'Budget',
      mode: 'insensitive',
    });
    expect(call.where.state).toEqual({ in: ['ACTIVE'] });
    expect(call.where.organizationId).toBe('org-2');
    expect(call.where.OR).toBeDefined();
    expect(call.where.archivedAt).toBeNull();
  });

  it('should include questions with answers and order by createdAt desc', async () => {
    mockPrisma.poll.findMany.mockResolvedValue([]);

    await repo.searchPolls({});

    expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should return failure when prisma throws', async () => {
    mockPrisma.poll.findMany.mockRejectedValue(new Error('DB error'));

    const result = await repo.searchPolls({});

    expect(result.success).toBe(false);

    if (result.success) {return;}

    expect(result.error).toBe('common.errors.unexpected');
  });
});
