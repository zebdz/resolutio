import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { UserId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import { Instant } from '@/domain/shared/Instant';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PollId } from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetOpenPollPreviewUseCase } from '../GetOpenPollPreviewUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollState } from '../../../domain/poll/PollState';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { success } from '../../../domain/shared/Result';

function makePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  let poll = expectSuccess(
    Poll.create(
      PollTitle.parse('Should we repave the yard?'),
      PollDescription.parse('Full description here'),
      OrganizationId.parse('org-1'),
      null,
      UserId.parse('user-admin'),
      expectSuccess(
        PollPeriod.create(new Date('2026-01-01'), new Date('2026-02-01'))
      ),
      testCreation(PollId, 'poll-1'),
      undefined,
      pollType
    )
  );
  poll = Poll.reconstitute({
    ...poll.toJSON(),
    questions: poll.questions,
    id: 'poll-1',
  });
  poll = Poll.reconstitute({
    ...poll.toJSON(),
    questions: poll.questions,
    finishedAt: null,
    state: PollState.ACTIVE,
  });

  return poll;
}

function makeOrganization(archivedAt: Date | null = null): Organization {
  return Organization.reconstitute({
    id: 'org-1',
    name: 'ТСЖ "Орион"',
    description: 'desc',
    parentId: null,
    createdById: 'user-admin',
    createdAt: new Date(),
    archivedAt,
    allowMultiTreeMembership: false,
  });
}

describe('GetOpenPollPreviewUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let useCase: GetOpenPollPreviewUseCase;

  beforeEach(() => {
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(makePoll('OPEN'))),
    };

    organizationRepository = {
      findById: vi.fn().mockResolvedValue(makeOrganization()),
    };

    useCase = new GetOpenPollPreviewUseCase(
      pollRepository as PollRepository,
      organizationRepository as OrganizationRepository
    );
  });

  it('returns the preview for an open poll', async () => {
    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.success).toBe(true);
    expect(expectSuccess(result)).toEqual({
      title: 'Should we repave the yard?',
      description: 'Full description here',
      // Ids only — the anonymous preview renders the description, so it needs
      // the allowlist, but never the file contents.
      attachmentIds: [],
      state: PollState.ACTIVE,
      organizationName: 'ТСЖ "Орион"',
    });
  });

  it('returns null for an organization poll', async () => {
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(makePoll('ORGANIZATION')));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.success).toBe(true);
    expect(expectSuccess(result)).toBeNull();
  });

  it('returns null for an archived open poll', async () => {
    const archived = makePoll('OPEN');
    archived.archive(Instant.parse('2026-01-02T00:00:00.000Z'));
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(archived));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(expectSuccess(result)).toBeNull();
  });

  it('returns null for an unknown poll', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({ pollId: 'nope' });

    expect(expectSuccess(result)).toBeNull();
  });

  it('returns null when the organization is archived', async () => {
    organizationRepository.findById = vi
      .fn()
      .mockResolvedValue(makeOrganization(new Date()));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(expectSuccess(result)).toBeNull();
  });

  it('does not ask for the organization when the poll is not open', async () => {
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(makePoll('ORGANIZATION')));

    await useCase.execute({ pollId: 'poll-1' });

    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it('reports a repository failure instead of masking it as "no poll"', async () => {
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'common.errors.unexpected' });

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe('common.errors.unexpected');
  });
});
