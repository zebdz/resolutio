import { describe, it, expect, vi } from 'vitest';
import { RemovePollAttachmentUseCase } from '../RemovePollAttachmentUseCase';
import { PollErrors } from '../PollErrors';
import { Poll } from '../../../domain/poll/Poll';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { success } from '../../../domain/shared/Result';

const CREATOR = 'creator-1';

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

function draftPoll(): Poll {
  const r = Poll.create(
    'Fence dispute',
    'The fence was moved.',
    'org-1',
    null,
    CREATOR,
    new Date('2030-01-01'),
    new Date('2030-02-01')
  );

  if (!r.success) {
    throw new Error('fixture poll failed: ' + r.error);
  }

  return r.value;
}

function activePoll(): Poll {
  const poll = draftPoll();
  poll.addQuestion(questionWithAnswer(poll.id));
  poll.submitToAdmin();
  poll.takeSnapshot();
  poll.activate();

  return poll;
}

function buildDeps(
  over: {
    poll?: Poll | null;
    metadata?: unknown;
    isAdmin?: boolean;
    isSuper?: boolean;
  } = {}
) {
  const poll = over.poll === undefined ? draftPoll() : over.poll;

  const polls = {
    getPollById: vi.fn().mockResolvedValue(success(poll)),
  };
  const orgs = {
    isUserAdmin: vi.fn().mockResolvedValue(over.isAdmin ?? false),
  };
  const users = {
    isSuperAdmin: vi.fn().mockResolvedValue(over.isSuper ?? false),
  };
  const attachments = {
    findById: vi.fn().mockResolvedValue(
      success(
        over.metadata === undefined
          ? {
              id: 'att-1',
              pollId: 'poll-1',
              fileName: 'a.png',
              mimeType: 'image/png',
              sizeBytes: 10,
              createdAt: new Date(),
            }
          : over.metadata
      )
    ),
    deleteById: vi.fn().mockResolvedValue(success(undefined)),
  };

  return {
    polls,
    orgs,
    users,
    attachments,
    uc: new RemovePollAttachmentUseCase(
      polls as never,
      orgs,
      users,
      attachments as never
    ),
  };
}

describe('RemovePollAttachmentUseCase', () => {
  it('returns not-found for a missing attachment', async () => {
    const d = buildDeps({ metadata: null });

    const r = await d.uc.execute({
      attachmentId: 'missing',
      callerId: CREATOR,
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND
    );
    expect(d.attachments.deleteById).not.toHaveBeenCalled();
  });

  it('returns not-found when the owning poll is gone', async () => {
    const d = buildDeps({ poll: null });

    const r = await d.uc.execute({
      attachmentId: 'att-1',
      callerId: CREATOR,
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(PollErrors.NOT_FOUND);
    expect(d.attachments.deleteById).not.toHaveBeenCalled();
  });

  it('rejects a caller who is neither creator, admin, nor superadmin', async () => {
    const d = buildDeps({});

    const r = await d.uc.execute({
      attachmentId: 'att-1',
      callerId: 'stranger',
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(PollErrors.NOT_AUTHORIZED);
    expect(d.attachments.deleteById).not.toHaveBeenCalled();
  });

  it('allows an org admin who is not the creator', async () => {
    const d = buildDeps({ isAdmin: true });

    const r = await d.uc.execute({
      attachmentId: 'att-1',
      callerId: 'admin-1',
    });

    expect(r.success).toBe(true);
  });

  it('allows a superadmin who is not the creator', async () => {
    const d = buildDeps({ isSuper: true });

    const r = await d.uc.execute({
      attachmentId: 'att-1',
      callerId: 'super-1',
    });

    expect(r.success).toBe(true);
  });

  it('refuses to remove from an active poll', async () => {
    const d = buildDeps({ poll: activePoll() });

    const r = await d.uc.execute({
      attachmentId: 'att-1',
      callerId: CREATOR,
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE
    );
    expect(d.attachments.deleteById).not.toHaveBeenCalled();
  });

  it('deletes a valid attachment', async () => {
    const d = buildDeps({});

    const r = await d.uc.execute({
      attachmentId: 'att-1',
      callerId: CREATOR,
    });

    expect(r.success).toBe(true);
    expect(d.attachments.deleteById).toHaveBeenCalledWith('att-1');
  });

  // The poll is looked up via the attachment's own pollId, not caller input,
  // so a caller cannot authorize against a poll they happen to own.
  it('authorizes against the poll that owns the attachment', async () => {
    const d = buildDeps({});

    await d.uc.execute({ attachmentId: 'att-1', callerId: CREATOR });

    expect(d.polls.getPollById).toHaveBeenCalledWith('poll-1');
  });
});
