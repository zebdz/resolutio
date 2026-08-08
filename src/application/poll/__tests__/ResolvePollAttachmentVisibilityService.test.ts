import { describe, it, expect, vi } from 'vitest';
import { ResolvePollAttachmentVisibilityService } from '../ResolvePollAttachmentVisibilityService';
import { Poll } from '../../../domain/poll/Poll';
import { PollType } from '../../../domain/poll/PollType';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';

const CREATOR = 'creator-1';
const ORG = 'org-1';

function questionWithAnswer(pollId: string): Question {
  const q = Question.create('Q?', pollId, 1, 0, 'single-choice');

  if (!q.success) {
    throw new Error('fixture question failed: ' + q.error);
  }

  const a = Answer.create('A', 1, q.value.id);

  if (!a.success) {
    throw new Error('fixture answer failed: ' + a.error);
  }

  q.value.addAnswer(a.value);

  return q.value;
}

function buildPoll(
  overrides: {
    pollType?: string;
    boardId?: string | null;
    state?: 'DRAFT' | 'ACTIVE';
    archived?: boolean;
  } = {}
): Poll {
  const r = Poll.create(
    'Fence dispute',
    'The fence was moved.',
    ORG,
    overrides.boardId ?? null,
    CREATOR,
    new Date('2030-01-01'),
    new Date('2030-02-01'),
    undefined,
    overrides.pollType ?? PollType.ORGANIZATION
  );

  if (!r.success) {
    throw new Error('fixture poll failed: ' + r.error);
  }

  const poll = r.value;

  // Polls start as DRAFT; most cases here want a live poll, since a DRAFT is
  // deliberately restricted to the creator and admins.
  if ((overrides.state ?? 'ACTIVE') === 'ACTIVE') {
    poll.addQuestion(questionWithAnswer(poll.id));
    poll.takeSnapshot();
    poll.activate();
  }

  if (overrides.archived) {
    poll.archive();
  }

  return poll;
}

function buildService(over: {
  isMember?: boolean;
  isAdmin?: boolean;
  isSuper?: boolean;
  isBoardMember?: boolean;
}) {
  const orgs = {
    isUserMember: vi.fn().mockResolvedValue(over.isMember ?? false),
    isUserAdmin: vi.fn().mockResolvedValue(over.isAdmin ?? false),
  };
  const boards = {
    isUserMember: vi.fn().mockResolvedValue(over.isBoardMember ?? false),
  };
  const users = {
    isSuperAdmin: vi.fn().mockResolvedValue(over.isSuper ?? false),
  };

  return {
    orgs,
    boards,
    users,
    svc: new ResolvePollAttachmentVisibilityService(orgs, boards, users),
  };
}

describe('ResolvePollAttachmentVisibilityService', () => {
  describe('open polls', () => {
    it('allows anonymous read', async () => {
      const { svc } = buildService({});
      const poll = buildPoll({ pollType: PollType.OPEN });

      expect(await svc.canRead(poll, null)).toBe(true);
    });

    it('does not expose a draft open poll anonymously', async () => {
      const { svc } = buildService({});
      const poll = buildPoll({ pollType: PollType.OPEN, state: 'DRAFT' });

      expect(await svc.canRead(poll, null)).toBe(false);
    });

    it('does not expose an archived open poll anonymously', async () => {
      const { svc } = buildService({});
      const poll = buildPoll({ pollType: PollType.OPEN, archived: true });

      expect(await svc.canRead(poll, null)).toBe(false);
    });
  });

  describe('organization polls', () => {
    it('denies anonymous read', async () => {
      const { svc } = buildService({});

      expect(await svc.canRead(buildPoll(), null)).toBe(false);
    });

    it('denies a non-member', async () => {
      const { svc } = buildService({ isMember: false });

      expect(await svc.canRead(buildPoll(), 'stranger')).toBe(false);
    });

    it('allows an org member', async () => {
      const { svc } = buildService({ isMember: true });

      expect(await svc.canRead(buildPoll(), 'member-1')).toBe(true);
    });

    it('allows the poll creator', async () => {
      const { svc } = buildService({});

      expect(await svc.canRead(buildPoll(), CREATOR)).toBe(true);
    });

    it('allows a superadmin', async () => {
      const { svc } = buildService({ isSuper: true });

      expect(await svc.canRead(buildPoll(), 'someone')).toBe(true);
    });

    it('allows an org admin', async () => {
      const { svc } = buildService({ isAdmin: true });

      expect(await svc.canRead(buildPoll(), 'admin-1')).toBe(true);
    });
  });

  describe('board-scoped polls', () => {
    it('denies an org member who is not on the board', async () => {
      const { svc } = buildService({ isMember: true, isBoardMember: false });
      const poll = buildPoll({ boardId: 'board-1' });

      expect(await svc.canRead(poll, 'member-1')).toBe(false);
    });

    it('allows a board member', async () => {
      const { svc } = buildService({ isMember: true, isBoardMember: true });
      const poll = buildPoll({ boardId: 'board-1' });

      expect(await svc.canRead(poll, 'member-1')).toBe(true);
    });
  });

  // A draft poll is still being composed and an archived one is withdrawn;
  // in both cases the evidence should not be readable org-wide, only by the
  // people who can still act on the poll. Mirrors ResolveReportVisibilityService.
  describe('draft and archived polls', () => {
    it('denies a plain org member on a draft poll', async () => {
      const { svc } = buildService({ isMember: true });
      const poll = buildPoll({ state: 'DRAFT' });

      expect(await svc.canRead(poll, 'member-1')).toBe(false);
    });

    it('still allows the creator on a draft poll', async () => {
      const { svc } = buildService({});
      const poll = buildPoll({ state: 'DRAFT' });

      expect(await svc.canRead(poll, CREATOR)).toBe(true);
    });

    it('still allows an org admin on a draft poll', async () => {
      const { svc } = buildService({ isAdmin: true });
      const poll = buildPoll({ state: 'DRAFT' });

      expect(await svc.canRead(poll, 'admin-1')).toBe(true);
    });

    it('denies a plain org member on an archived poll', async () => {
      const { svc } = buildService({ isMember: true });
      const poll = buildPoll({ archived: true });

      expect(await svc.canRead(poll, 'member-1')).toBe(false);
    });

    it('still allows a superadmin on an archived poll', async () => {
      const { svc } = buildService({ isSuper: true });
      const poll = buildPoll({ archived: true });

      expect(await svc.canRead(poll, 'someone')).toBe(true);
    });
  });
});
