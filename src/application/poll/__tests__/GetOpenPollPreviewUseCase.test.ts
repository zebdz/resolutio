import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetOpenPollPreviewUseCase } from '../GetOpenPollPreviewUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollState } from '../../../domain/poll/PollState';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { success } from '../../../domain/shared/Result';

function makePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = Poll.create(
    'Should we repave the yard?',
    'Full description here',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    pollType
  ).value;
  (poll as any).props.id = 'poll-1';
  (poll as any).props.state = PollState.ACTIVE;

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
    expect(result.value).toEqual({
      title: 'Should we repave the yard?',
      description: 'Full description here',
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
    expect(result.value).toBeNull();
  });

  it('returns null for an archived open poll', async () => {
    const archived = makePoll('OPEN');
    (archived as any).props.archivedAt = new Date();
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(archived));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.value).toBeNull();
  });

  it('returns null for an unknown poll', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({ pollId: 'nope' });

    expect(result.value).toBeNull();
  });

  it('returns null when the organization is archived', async () => {
    organizationRepository.findById = vi
      .fn()
      .mockResolvedValue(makeOrganization(new Date()));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.value).toBeNull();
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
    expect(result.error).toBe('common.errors.unexpected');
  });
});
