import { Result, success, failure } from '../shared/Result';
import { Poll } from './Poll';
import { PollDomainCodes } from './PollDomainCodes';

export interface VoterFacts {
  isParticipant: boolean;
  isConfirmedUser: boolean;
  hasFinishedVoting: boolean;
}

/**
 * Single source of truth for "may this user cast a vote in this poll".
 *
 * Organization polls have a fixed electorate: the snapshot decided it, so the
 * voter must already be a participant. Open polls have no snapshot — the
 * electorate is every verified platform user, and the participant row is
 * created at the moment the vote is finished.
 */
function canVote(poll: Poll, facts: VoterFacts): Result<void, string> {
  if (poll.isFinished()) {
    return failure(PollDomainCodes.POLL_FINISHED);
  }

  if (!poll.isActive()) {
    return failure(PollDomainCodes.POLL_NOT_ACTIVE);
  }

  if (poll.isOpen()) {
    if (!facts.isConfirmedUser) {
      return failure(PollDomainCodes.USER_NOT_CONFIRMED);
    }
  } else if (!facts.isParticipant) {
    return failure(PollDomainCodes.NOT_PARTICIPANT);
  }

  if (facts.hasFinishedVoting) {
    return failure(PollDomainCodes.ALREADY_VOTED);
  }

  return success(undefined);
}

export const PollVotingPolicy = { canVote };
