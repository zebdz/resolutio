import { describe, it, expect } from 'vitest';
import { createPollSchema } from '../PollSchemas';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { ProfanityChecker } from '../../../domain/shared/profanity/ProfanityChecker';

const noProfanity: ProfanityChecker = {
  containsProfanity: () => false,
  findProfaneWords: () => [],
};

const base = {
  title: 'Open Poll',
  description: 'Everyone may vote',
  organizationId: 'org-1',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-02-01'),
};

describe('createPollSchema pollType', () => {
  it('leaves pollType undefined when not supplied (use case defaults to ORGANIZATION)', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: null,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pollType).toBeUndefined();
  });

  it('accepts OPEN with no board', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: null,
      pollType: 'OPEN',
    });

    expect(result.success).toBe(true);
    expect(result.data!.pollType).toBe('OPEN');
  });

  it('accepts ORGANIZATION with a board', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: 'board-1',
      pollType: 'ORGANIZATION',
    });

    expect(result.success).toBe(true);
  });

  it('rejects OPEN combined with a board', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: 'board-1',
      pollType: 'OPEN',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED
    );
  });

  it('rejects an unknown poll type', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: null,
      pollType: 'PUBLIC',
    });

    expect(result.success).toBe(false);
  });
});
