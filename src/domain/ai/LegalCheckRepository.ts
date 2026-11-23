/** Analysis storage and quota accounting expose validated identities/counts and explicit cutoffs. */
import { LegalCheck } from './LegalCheck';
import { PollId, UserId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { TokenCount, LegalCheckCount } from './LegalAnalysis';
export interface AnalysisTokenUsage {
  readonly input: TokenCount;
  readonly output: TokenCount;
}
export interface LegalCheckRepository {
  upsert(legalCheck: LegalCheck): Promise<LegalCheck>;
  findByPollId(
    pollId: PollId
  ): Promise<{ check: LegalCheck; isStale: boolean } | null>;
  markStale(pollId: PollId): Promise<void>;
  logCheckAttempt(
    pollId: PollId,
    checkedBy: UserId,
    usage: AnalysisTokenUsage,
    at: Instant
  ): Promise<void>;
  countRecentChecks(
    checkedBy: UserId,
    since: Instant
  ): Promise<LegalCheckCount>;
  sumDailyTokens(checkedBy: UserId, dayStart: Instant): Promise<TokenCount>;
}
