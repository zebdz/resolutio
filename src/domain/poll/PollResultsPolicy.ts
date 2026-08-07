import { Result, success, failure } from '../shared/Result';
import { Poll } from './Poll';
import { PollDomainCodes } from './PollDomainCodes';

export interface ResultsViewerFacts {
  // Org admin or platform superadmin.
  isAdmin: boolean;
  isOrgMember: boolean;
  // Has a PollParticipant row. For an open poll that means they actually cast
  // a vote, since the row is created at vote time.
  isPollVoter: boolean;
}

/**
 * Single source of truth for "what may this viewer see of this poll's results".
 *
 * An anonymous poll behaves the way every poll behaved before the flag existed:
 * admins only, and nothing until the poll is finished. A named poll opens the
 * tally and the voter names to the organization while the vote is still
 * running — that transparency is the point of it.
 *
 * Sign-willingness stays admin-only in both cases: it carries phone numbers
 * collected under a separate consent, not part of the voting record.
 */
function canViewResults(
  poll: Poll,
  facts: ResultsViewerFacts
): Result<void, string> {
  if (facts.isAdmin) {
    return success(undefined);
  }

  // An open poll is voted on by outsiders too, so anyone who actually cast a
  // vote in it may see the outcome they took part in.
  const isAudience = facts.isOrgMember || (poll.isOpen() && facts.isPollVoter);

  if (!isAudience) {
    return failure(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  }

  if (poll.isAnonymous() && poll.isActive()) {
    return failure(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  }

  return success(undefined);
}

function canViewVoterNames(poll: Poll, facts: ResultsViewerFacts): boolean {
  if (facts.isAdmin) {
    return true;
  }

  if (poll.isAnonymous()) {
    return false;
  }

  return canViewResults(poll, facts).success;
}

function canViewSignWillingness(facts: ResultsViewerFacts): boolean {
  return facts.isAdmin;
}

/**
 * The existing results protocol. A named poll may be exported mid-vote — the
 * generator marks such a document preliminary.
 */
function canExportProtocol(
  poll: Poll,
  facts: ResultsViewerFacts
): Result<void, string> {
  const readable = canViewResults(poll, facts);

  if (!readable.success) {
    return readable;
  }

  if (poll.isFinished()) {
    return success(undefined);
  }

  if (!poll.isAnonymous() && poll.isActive()) {
    return success(undefined);
  }

  return failure(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
}

function canExportNamedProtocol(
  poll: Poll,
  facts: ResultsViewerFacts
): Result<void, string> {
  if (poll.isAnonymous()) {
    return failure(PollDomainCodes.POLL_IS_ANONYMOUS);
  }

  // Before activation there are no votes, so there is no record to name.
  if (!poll.isActive() && !poll.isFinished()) {
    return failure(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
  }

  if (!canViewVoterNames(poll, facts)) {
    return failure(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  }

  return success(undefined);
}

export const PollResultsPolicy = {
  canViewResults,
  canViewVoterNames,
  canViewSignWillingness,
  canExportProtocol,
  canExportNamedProtocol,
};
