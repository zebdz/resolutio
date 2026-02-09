import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { Poll } from '../../../domain/poll/Poll';
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

// --- Helpers: build typical Prisma result objects ---

const now = new Date('2025-06-01T00:00:00Z');
const startDate = new Date('2025-07-01T00:00:00Z');
const endDate = new Date('2025-08-01T00:00:00Z');

function buildPrismaAnswer(overrides: Record<string, any> = {}) {
  return {
    id: 'answer-1',
    text: 'Yes',
    order: 0,
    questionId: 'question-1',
    createdAt: now,
    archivedAt: null,
    ...overrides,
  };
}

function buildPrismaQuestion(overrides: Record<string, any> = {}) {
  return {
    id: 'question-1',
    text: 'Do you agree?',
    details: null,
    pollId: 'poll-1',
    page: 1,
    order: 0,
    questionType: 'single-choice',
    createdAt: now,
    archivedAt: null,
    answers: [buildPrismaAnswer()],
    ...overrides,
  };
}

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
    questions: [buildPrismaQuestion()],
    ...overrides,
  };
}

function buildDomainPoll(state: PollState = PollState.DRAFT): Poll {
  return Poll.reconstitute({
    id: 'poll-1',
    title: 'Test Poll',
    description: 'A test poll description',
    organizationId: 'org-1',
    boardId: 'board-1',
    createdBy: 'user-1',
    startDate,
    endDate,
    state,
    weightCriteria: null,
    createdAt: now,
    archivedAt: null,
    questions: [],
  });
}

describe('PrismaPollRepository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let repo: PrismaPollRepository;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repo = new PrismaPollRepository(mockPrisma as any);
  });

  // -------------------------------------------------------------------
  // toDomainPoll reconstitution (tested through public methods)
  // -------------------------------------------------------------------
  describe('reconstitution via getPollById', () => {
    it('should reconstitute a Poll with nested questions and answers', async () => {
      const prismaData = buildPrismaPoll();
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      const poll = result.value!;
      expect(poll.id).toBe('poll-1');
      expect(poll.title).toBe('Test Poll');
      expect(poll.description).toBe('A test poll description');
      expect(poll.organizationId).toBe('org-1');
      expect(poll.boardId).toBe('board-1');
      expect(poll.createdBy).toBe('user-1');
      expect(poll.startDate).toEqual(startDate);
      expect(poll.endDate).toEqual(endDate);
      expect(poll.state).toBe(PollState.DRAFT);
      expect(poll.weightCriteria).toBeNull();
      expect(poll.createdAt).toEqual(now);
      expect(poll.archivedAt).toBeNull();

      // Questions
      expect(poll.questions).toHaveLength(1);
      const q = poll.questions[0];
      expect(q.id).toBe('question-1');
      expect(q.text).toBe('Do you agree?');
      expect(q.details).toBeNull();
      expect(q.pollId).toBe('poll-1');
      expect(q.page).toBe(1);
      expect(q.order).toBe(0);
      expect(q.questionType).toBe('single-choice');

      // Answers
      expect(q.answers).toHaveLength(1);
      const a = q.answers[0];
      expect(a.id).toBe('answer-1');
      expect(a.text).toBe('Yes');
      expect(a.order).toBe(0);
      expect(a.questionId).toBe('question-1');
    });

    it('should reconstitute poll with multiple questions and answers', async () => {
      const prismaData = buildPrismaPoll({
        questions: [
          buildPrismaQuestion({
            id: 'q-1',
            answers: [
              buildPrismaAnswer({ id: 'a-1', questionId: 'q-1' }),
              buildPrismaAnswer({
                id: 'a-2',
                text: 'No',
                order: 1,
                questionId: 'q-1',
              }),
            ],
          }),
          buildPrismaQuestion({
            id: 'q-2',
            text: 'Second question?',
            page: 2,
            order: 0,
            answers: [
              buildPrismaAnswer({
                id: 'a-3',
                text: 'Maybe',
                questionId: 'q-2',
              }),
            ],
          }),
        ],
      });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      const poll = result.value!;
      expect(poll.questions).toHaveLength(2);
      expect(poll.questions[0].answers).toHaveLength(2);
      expect(poll.questions[1].text).toBe('Second question?');
      expect(poll.questions[1].answers[0].text).toBe('Maybe');
    });

    it('should reconstitute poll with no questions', async () => {
      const prismaData = buildPrismaPoll({ questions: [] });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions).toHaveLength(0);
    });

    it('should handle question with no answers', async () => {
      const prismaData = buildPrismaPoll({
        questions: [buildPrismaQuestion({ answers: [] })],
      });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions[0].answers).toHaveLength(0);
    });

    it('should map weightCriteria when present', async () => {
      const prismaData = buildPrismaPoll({ weightCriteria: 'shares' });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.weightCriteria).toBe('shares');
    });

    it('should map null weightCriteria from falsy value', async () => {
      const prismaData = buildPrismaPoll({ weightCriteria: '' });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      // '' is falsy, so weightCriteria || null => null
      expect(result.value!.weightCriteria).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // State mapping
  // -------------------------------------------------------------------
  describe('state mapping', () => {
    const cases: [string, PollState][] = [
      ['DRAFT', PollState.DRAFT],
      ['READY', PollState.READY],
      ['ACTIVE', PollState.ACTIVE],
      ['FINISHED', PollState.FINISHED],
    ];

    it.each(cases)(
      'should map Prisma state %s to domain state %s',
      async (prismaState, expectedDomainState) => {
        const prismaData = buildPrismaPoll({ state: prismaState });
        mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

        const result = await repo.getPollById('poll-1');
        expect(result.success).toBe(true);

        if (!result.success) {
          return;
        }

        expect(result.value!.state).toBe(expectedDomainState);
      }
    );

    it.each(cases)(
      'should map domain state %s to Prisma state %s on create',
      async (expectedPrismaState, domainState) => {
        const domainPoll = buildDomainPoll(domainState);
        mockPrisma.poll.create.mockResolvedValue(
          buildPrismaPoll({ state: expectedPrismaState })
        );

        await repo.createPoll(domainPoll);

        expect(mockPrisma.poll.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              state: expectedPrismaState,
            }),
          })
        );
      }
    );

    it.each(cases)(
      'should map domain state %s to Prisma state %s on update',
      async (expectedPrismaState, domainState) => {
        const domainPoll = buildDomainPoll(domainState);
        mockPrisma.poll.update.mockResolvedValue(undefined);

        await repo.updatePoll(domainPoll);

        expect(mockPrisma.poll.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              state: expectedPrismaState,
            }),
          })
        );
      }
    );
  });

  // -------------------------------------------------------------------
  // createPoll
  // -------------------------------------------------------------------
  describe('createPoll', () => {
    it('should pass correct data and include nested relations', async () => {
      const domainPoll = buildDomainPoll();
      const prismaResult = buildPrismaPoll();
      mockPrisma.poll.create.mockResolvedValue(prismaResult);

      const result = await repo.createPoll(domainPoll);

      expect(mockPrisma.poll.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Poll',
          description: 'A test poll description',
          organizationId: 'org-1',
          boardId: 'board-1',
          createdBy: 'user-1',
          startDate,
          endDate,
          state: 'DRAFT',
          weightCriteria: null,
        },
        include: {
          questions: {
            include: {
              answers: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
        },
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value.id).toBe('poll-1');
      expect(result.value.title).toBe('Test Poll');
    });

    it('should return failure when prisma throws', async () => {
      const domainPoll = buildDomainPoll();
      mockPrisma.poll.create.mockRejectedValue(new Error('DB error'));

      const result = await repo.createPoll(domainPoll);

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // getPollById
  // -------------------------------------------------------------------
  describe('getPollById', () => {
    it('should query with correct where clause and include', async () => {
      mockPrisma.poll.findUnique.mockResolvedValue(buildPrismaPoll());

      await repo.getPollById('poll-1');

      expect(mockPrisma.poll.findUnique).toHaveBeenCalledWith({
        where: { id: 'poll-1' },
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
      });
    });

    it('should return null when poll not found', async () => {
      mockPrisma.poll.findUnique.mockResolvedValue(null);

      const result = await repo.getPollById('nonexistent');

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value).toBeNull();
    });

    it('should return failure on error', async () => {
      mockPrisma.poll.findUnique.mockRejectedValue(new Error('DB down'));

      const result = await repo.getPollById('poll-1');

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // getPollsByBoardId
  // -------------------------------------------------------------------
  describe('getPollsByBoardId', () => {
    it('should filter by boardId and archivedAt null', async () => {
      mockPrisma.poll.findMany.mockResolvedValue([buildPrismaPoll()]);

      const result = await repo.getPollsByBoardId('board-1');

      expect(mockPrisma.poll.findMany).toHaveBeenCalledWith({
        where: {
          boardId: 'board-1',
          archivedAt: null,
        },
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
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe('poll-1');
    });

    it('should return empty array when no polls found', async () => {
      mockPrisma.poll.findMany.mockResolvedValue([]);

      const result = await repo.getPollsByBoardId('board-1');

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value).toHaveLength(0);
    });

    it('should reconstitute multiple polls', async () => {
      mockPrisma.poll.findMany.mockResolvedValue([
        buildPrismaPoll({ id: 'poll-1' }),
        buildPrismaPoll({ id: 'poll-2', title: 'Second poll' }),
      ]);

      const result = await repo.getPollsByBoardId('board-1');

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe('poll-1');
      expect(result.value[1].id).toBe('poll-2');
      expect(result.value[1].title).toBe('Second poll');
    });

    it('should return failure on error', async () => {
      mockPrisma.poll.findMany.mockRejectedValue(new Error('DB error'));

      const result = await repo.getPollsByBoardId('board-1');

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // getPollsByOrganizationId
  // -------------------------------------------------------------------
  describe('getPollsByOrganizationId', () => {
    it('should filter by organizationId and archivedAt null', async () => {
      mockPrisma.poll.findMany.mockResolvedValue([buildPrismaPoll()]);

      const result = await repo.getPollsByOrganizationId('org-1');

      expect(mockPrisma.poll.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          archivedAt: null,
        },
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
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value).toHaveLength(1);
    });

    it('should return failure on error', async () => {
      mockPrisma.poll.findMany.mockRejectedValue(new Error('DB error'));

      const result = await repo.getPollsByOrganizationId('org-1');

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // getPollsByUserId
  // -------------------------------------------------------------------
  describe('getPollsByUserId', () => {
    it('should filter by org membership, board membership, or participant', async () => {
      mockPrisma.poll.findMany.mockResolvedValue([buildPrismaPoll()]);

      const result = await repo.getPollsByUserId('user-1');

      expect(mockPrisma.poll.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              organization: {
                members: {
                  some: {
                    userId: 'user-1',
                    status: 'accepted',
                  },
                },
              },
            },
            {
              board: {
                members: {
                  some: {
                    userId: 'user-1',
                    removedAt: null,
                  },
                },
              },
            },
            {
              participants: {
                some: {
                  userId: 'user-1',
                },
              },
            },
          ],
          archivedAt: null,
        },
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
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value).toHaveLength(1);
    });

    it('should return failure on error', async () => {
      mockPrisma.poll.findMany.mockRejectedValue(new Error('DB error'));

      const result = await repo.getPollsByUserId('user-1');

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // updatePoll
  // -------------------------------------------------------------------
  describe('updatePoll', () => {
    it('should pass correct fields to prisma update', async () => {
      const domainPoll = buildDomainPoll();
      mockPrisma.poll.update.mockResolvedValue(undefined);

      const result = await repo.updatePoll(domainPoll);

      expect(mockPrisma.poll.update).toHaveBeenCalledWith({
        where: { id: 'poll-1' },
        data: {
          title: 'Test Poll',
          description: 'A test poll description',
          startDate,
          endDate,
          state: 'DRAFT',
          weightCriteria: null,
          archivedAt: null,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should include archivedAt when poll is archived', async () => {
      const archivedAt = new Date('2025-09-01T00:00:00Z');
      const domainPoll = Poll.reconstitute({
        id: 'poll-1',
        title: 'Archived Poll',
        description: 'desc',
        organizationId: 'org-1',
        boardId: 'board-1',
        createdBy: 'user-1',
        startDate,
        endDate,
        state: PollState.DRAFT,
        weightCriteria: null,
        createdAt: now,
        archivedAt,
        questions: [],
      });
      mockPrisma.poll.update.mockResolvedValue(undefined);

      await repo.updatePoll(domainPoll);

      expect(mockPrisma.poll.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            archivedAt,
          }),
        })
      );
    });

    it('should return failure on error', async () => {
      const domainPoll = buildDomainPoll();
      mockPrisma.poll.update.mockRejectedValue(new Error('DB error'));

      const result = await repo.updatePoll(domainPoll);

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // deletePoll (soft-delete via archivedAt)
  // -------------------------------------------------------------------
  describe('deletePoll', () => {
    it('should set archivedAt via update', async () => {
      mockPrisma.poll.update.mockResolvedValue(undefined);

      const result = await repo.deletePoll('poll-1');

      expect(mockPrisma.poll.update).toHaveBeenCalledWith({
        where: { id: 'poll-1' },
        data: { archivedAt: expect.any(Date) },
      });

      expect(result.success).toBe(true);
    });

    it('should return failure on error', async () => {
      mockPrisma.poll.update.mockRejectedValue(new Error('DB error'));

      const result = await repo.deletePoll('poll-1');

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe('common.errors.unexpected');
    });
  });

  // -------------------------------------------------------------------
  // Edge cases for reconstitution
  // -------------------------------------------------------------------
  describe('reconstitution edge cases', () => {
    it('should handle missing questions array (undefined)', async () => {
      const prismaData = buildPrismaPoll();
      delete prismaData.questions;
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions).toHaveLength(0);
    });

    it('should handle missing answers array on question (undefined)', async () => {
      const question = buildPrismaQuestion();
      delete (question as any).answers;
      const prismaData = buildPrismaPoll({ questions: [question] });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions[0].answers).toHaveLength(0);
    });

    it('should preserve question details when present', async () => {
      const prismaData = buildPrismaPoll({
        questions: [
          buildPrismaQuestion({ details: 'Some detailed explanation' }),
        ],
      });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions[0].details).toBe(
        'Some detailed explanation'
      );
    });

    it('should preserve archivedAt on answers when present', async () => {
      const archivedDate = new Date('2025-06-15T00:00:00Z');
      const prismaData = buildPrismaPoll({
        questions: [
          buildPrismaQuestion({
            answers: [buildPrismaAnswer({ archivedAt: archivedDate })],
          }),
        ],
      });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions[0].answers[0].archivedAt).toEqual(
        archivedDate
      );
    });

    it('should reconstitute multiple-choice question type', async () => {
      const prismaData = buildPrismaPoll({
        questions: [buildPrismaQuestion({ questionType: 'multiple-choice' })],
      });
      mockPrisma.poll.findUnique.mockResolvedValue(prismaData);

      const result = await repo.getPollById('poll-1');
      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value!.questions[0].questionType).toBe('multiple-choice');
    });
  });
});
