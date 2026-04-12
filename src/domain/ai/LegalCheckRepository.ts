import type { LegalCheck } from './LegalCheck';

export interface LegalCheckRepository {
  upsert(legalCheck: LegalCheck): Promise<LegalCheck>;
  findByPollId(
    pollId: string
  ): Promise<{ check: LegalCheck; isStale: boolean } | null>;
  markStale(pollId: string): Promise<void>;
  logCheckAttempt(
    pollId: string,
    checkedBy: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void>;
  countRecentChecks(checkedBy: string, windowMs: number): Promise<number>;
  sumDailyTokens(checkedBy: string): Promise<number>;
}
