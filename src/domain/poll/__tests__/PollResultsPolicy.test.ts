import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollState } from '../PollState';
import { PollResultsPolicy, ResultsViewerFacts } from '../PollResultsPolicy';
import { PollDomainCodes } from '../PollDomainCodes';

type Kind = 'ORGANIZATION' | 'OPEN';

function makePoll(
  state: PollState,
  opts: { anonymous?: boolean; pollType?: Kind } = {}
): Poll {
  const poll = Poll.create(
    'Title',
    'Description',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    opts.pollType ?? 'ORGANIZATION',
    opts.anonymous ?? false
  ).value;

  const question = Question.create('Q1', 'poll-1', 1, 0, 'single-choice').value;
  question.addAnswer(Answer.create('A1', 1, 'question-1').value);
  poll.addQuestion(question);

  if (state !== PollState.DRAFT) {
    poll.submitToAdmin();
    poll.takeSnapshot();
  }

  if (state === PollState.ACTIVE || state === PollState.FINISHED) {
    poll.activate();
  }

  if (state === PollState.FINISHED) {
    poll.finish();
  }

  return poll;
}

const admin: ResultsViewerFacts = {
  isAdmin: true,
  isOrgMember: true,
  isPollVoter: true,
};
const member: ResultsViewerFacts = {
  isAdmin: false,
  isOrgMember: true,
  isPollVoter: false,
};
const openVoter: ResultsViewerFacts = {
  isAdmin: false,
  isOrgMember: false,
  isPollVoter: true,
};
const outsider: ResultsViewerFacts = {
  isAdmin: false,
  isOrgMember: false,
  isPollVoter: false,
};

describe('PollResultsPolicy.canViewResults', () => {
  it('lets an admin read an active anonymous poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { anonymous: true }),
      admin
    );

    expect(result.success).toBe(true);
  });

  it('refuses a member on an active anonymous poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { anonymous: true }),
      member
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('lets a member read an active named poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE),
      member
    );

    expect(result.success).toBe(true);
  });

  it('lets a member read a finished anonymous poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED, { anonymous: true }),
      member
    );

    expect(result.success).toBe(true);
  });

  it('refuses an outsider on any poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED),
      outsider
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  });

  it('lets an open-poll voter read a finished open poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED, { pollType: 'OPEN' }),
      openVoter
    );

    expect(result.success).toBe(true);
  });

  it('lets an open-poll voter read an ACTIVE named open poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { pollType: 'OPEN' }),
      openVoter
    );

    expect(result.success).toBe(true);
  });

  it('refuses an open-poll voter on an ACTIVE anonymous open poll', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { pollType: 'OPEN', anonymous: true }),
      openVoter
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('refuses a poll voter on a non-open poll they are not a member of', () => {
    const result = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED),
      openVoter
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  });

  it('lets a member read DRAFT and READY polls of either kind', () => {
    for (const state of [PollState.DRAFT, PollState.READY]) {
      for (const anonymous of [true, false]) {
        expect(
          PollResultsPolicy.canViewResults(
            makePoll(state, { anonymous }),
            member
          ).success
        ).toBe(true);
      }
    }
  });
});

describe('PollResultsPolicy.canViewVoterNames', () => {
  it('is true for an admin even on an anonymous poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(
        makePoll(PollState.FINISHED, { anonymous: true }),
        admin
      )
    ).toBe(true);
  });

  it('is false for a member on an anonymous poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(
        makePoll(PollState.FINISHED, { anonymous: true }),
        member
      )
    ).toBe(false);
  });

  it('is true for a member on an active named poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(makePoll(PollState.ACTIVE), member)
    ).toBe(true);
  });

  it('is false for an outsider on a named poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(
        makePoll(PollState.FINISHED),
        outsider
      )
    ).toBe(false);
  });
});

describe('PollResultsPolicy.canViewSignWillingness', () => {
  it('is admin-only regardless of the anonymous flag', () => {
    expect(PollResultsPolicy.canViewSignWillingness(admin)).toBe(true);
    expect(PollResultsPolicy.canViewSignWillingness(member)).toBe(false);
    expect(PollResultsPolicy.canViewSignWillingness(openVoter)).toBe(false);
  });
});

describe('PollResultsPolicy.canExportProtocol', () => {
  it('refuses everyone before FINISHED on an anonymous poll', () => {
    const poll = makePoll(PollState.ACTIVE, { anonymous: true });

    expect(PollResultsPolicy.canExportProtocol(poll, admin).error).toBe(
      PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE
    );
  });

  it('allows an admin on a finished anonymous poll', () => {
    expect(
      PollResultsPolicy.canExportProtocol(
        makePoll(PollState.FINISHED, { anonymous: true }),
        admin
      ).success
    ).toBe(true);
  });

  it('allows a member on an ACTIVE named poll', () => {
    expect(
      PollResultsPolicy.canExportProtocol(makePoll(PollState.ACTIVE), member)
        .success
    ).toBe(true);
  });

  it('refuses on a READY named poll — nothing has been voted yet', () => {
    expect(
      PollResultsPolicy.canExportProtocol(makePoll(PollState.READY), admin)
        .error
    ).toBe(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
  });

  it('propagates the read refusal for an outsider', () => {
    expect(
      PollResultsPolicy.canExportProtocol(
        makePoll(PollState.FINISHED),
        outsider
      ).error
    ).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  });
});

describe('PollResultsPolicy.canExportNamedProtocol', () => {
  it('refuses on an anonymous poll even for an admin', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.FINISHED, { anonymous: true }),
        admin
      ).error
    ).toBe(PollDomainCodes.POLL_IS_ANONYMOUS);
  });

  it('allows a member on an ACTIVE named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.ACTIVE),
        member
      ).success
    ).toBe(true);
  });

  it('allows a member on a FINISHED named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.FINISHED),
        member
      ).success
    ).toBe(true);
  });

  it('refuses on a READY named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(makePoll(PollState.READY), admin)
        .error
    ).toBe(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
  });

  it('refuses an outsider on a named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.FINISHED),
        outsider
      ).error
    ).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('allows an open-poll voter on a named open poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.ACTIVE, { pollType: 'OPEN' }),
        openVoter
      ).success
    ).toBe(true);
  });
});
