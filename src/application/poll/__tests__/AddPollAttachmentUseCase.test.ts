import { describe, it, expect, vi } from 'vitest';
import { AddPollAttachmentUseCase } from '../AddPollAttachmentUseCase';
import { PollErrors } from '../PollErrors';
import { Poll } from '../../../domain/poll/Poll';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { POLL_ATTACHMENT_COUNT_LIMIT } from '../../../domain/poll/PollAttachment';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { success } from '../../../domain/shared/Result';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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
  poll.takeSnapshot();
  poll.activate();

  return poll;
}

function buildDeps(
  over: {
    poll?: Poll | null;
    count?: number;
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
    countByPollId: vi.fn().mockResolvedValue(success(over.count ?? 0)),
    save: vi.fn().mockResolvedValue(
      success({
        id: 'att-new',
        pollId: 'poll-1',
        fileName: 'a.png',
        mimeType: 'image/png',
        sizeBytes: PNG.length,
        createdAt: new Date(),
      })
    ),
  };

  return {
    poll,
    polls,
    orgs,
    users,
    attachments,
    uc: new AddPollAttachmentUseCase(
      polls as never,
      orgs,
      users,
      attachments as never
    ),
  };
}

function validInput(over: Partial<{ callerId: string }> = {}) {
  return {
    pollId: 'poll-1',
    callerId: over.callerId ?? CREATOR,
    fileName: 'a.png',
    mimeType: 'image/png',
    bytes: PNG,
  };
}

describe('AddPollAttachmentUseCase', () => {
  it('returns not-found for a missing poll', async () => {
    const d = buildDeps({ poll: null });

    const r = await d.uc.execute(validInput());

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(PollErrors.NOT_FOUND);
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('rejects a caller who is neither creator, admin, nor superadmin', async () => {
    const d = buildDeps({});

    const r = await d.uc.execute(validInput({ callerId: 'stranger' }));

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(PollErrors.NOT_AUTHORIZED);
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('allows an org admin who is not the creator', async () => {
    const d = buildDeps({ isAdmin: true });

    const r = await d.uc.execute(validInput({ callerId: 'admin-1' }));

    expect(r.success).toBe(true);
  });

  it('allows a superadmin who is not the creator', async () => {
    const d = buildDeps({ isSuper: true });

    const r = await d.uc.execute(validInput({ callerId: 'super-1' }));

    expect(r.success).toBe(true);
  });

  it('refuses to attach to an active poll', async () => {
    const d = buildDeps({ poll: activePoll() });

    const r = await d.uc.execute(validInput());

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE
    );
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('rejects once the count limit is reached', async () => {
    const d = buildDeps({ count: POLL_ATTACHMENT_COUNT_LIMIT });

    const r = await d.uc.execute(validInput());

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED
    );
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('rejects a file whose magic bytes do not match its declared type', async () => {
    const d = buildDeps({});

    const r = await d.uc.execute({
      ...validInput(),
      fileName: 'evil.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_MAGIC_MISMATCH
    );
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('saves a valid attachment and returns its id', async () => {
    const d = buildDeps({});

    const r = await d.uc.execute(validInput());

    expect(r.success).toBe(true);
    expect(r.success === true && r.value.id).toBe('att-new');
    expect(d.attachments.save).toHaveBeenCalledOnce();
  });

  // The count check must precede byte validation so an over-limit upload is
  // rejected without reading the file.
  it('checks the count limit before validating the file', async () => {
    const d = buildDeps({ count: POLL_ATTACHMENT_COUNT_LIMIT });

    const r = await d.uc.execute({
      ...validInput(),
      bytes: Buffer.from([0x00, 0x00]),
    });

    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED
    );
  });
});
