/** Persists validated analysis snapshots and maps quota results into core units. */
import { PollId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { TokenCount, LegalCheckCount } from '@/domain/ai/LegalAnalysis';
import { AnalysisTokenUsage } from '@/domain/ai/LegalCheckRepository';
import type { PrismaClient } from '@/generated/prisma/client';
import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';
import { LegalCheck } from '@/domain/ai/LegalCheck';
import type {
  LegalAnnotation,
  LegalAnalysisSummary,
} from '@/domain/ai/LegalAnalysis';

export class PrismaLegalCheckRepository implements LegalCheckRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(legalCheck: LegalCheck): Promise<LegalCheck> {
    const data = {
      model: legalCheck.model,
      annotations: JSON.parse(JSON.stringify(legalCheck.annotations)),
      summary: JSON.parse(JSON.stringify(legalCheck.summary)),
      overallRisk: legalCheck.overallRisk,
      totalIssues: legalCheck.totalIssues,
      checkedBy: legalCheck.checkedBy,
      checkedAt: legalCheck.checkedAt,
      isStale: false,
    };

    const saved = await this.prisma.pollLegalCheck.upsert({
      where: { pollId: legalCheck.pollId },
      create: {
        id: legalCheck.id,
        pollId: legalCheck.pollId,
        ...data,
      },
      update: data,
    });

    return LegalCheck.reconstitute({
      id: saved.id,
      pollId: saved.pollId,
      model: saved.model,
      annotations: saved.annotations,
      summary: saved.summary,
      overallRisk: saved.overallRisk,
      totalIssues: saved.totalIssues,
      checkedBy: saved.checkedBy,
      checkedAt: saved.checkedAt,
    });
  }

  async findByPollId(
    pollId: PollId
  ): Promise<{ check: LegalCheck; isStale: boolean } | null> {
    const found = await this.prisma.pollLegalCheck.findUnique({
      where: { pollId },
    });

    if (!found) {
      return null;
    }

    return {
      check: LegalCheck.reconstitute({
        id: found.id,
        pollId: found.pollId,
        model: found.model,
        annotations: found.annotations,
        summary: found.summary,
        overallRisk: found.overallRisk,
        totalIssues: found.totalIssues,
        checkedBy: found.checkedBy,
        checkedAt: found.checkedAt,
      }),
      isStale: found.isStale,
    };
  }

  async markStale(pollId: PollId): Promise<void> {
    await this.prisma.pollLegalCheck.updateMany({
      where: { pollId },
      data: { isStale: true },
    });
  }

  async logCheckAttempt(
    pollId: PollId,
    checkedBy: UserId,
    usage: AnalysisTokenUsage,
    at: Instant
  ): Promise<void> {
    await this.prisma.pollLegalCheckLog.create({
      data: {
        pollId,
        checkedBy,
        inputTokens: usage.input,
        outputTokens: usage.output,
        checkedAt: Instant.toDate(at),
      },
    });
  }
  async countRecentChecks(
    checkedBy: UserId,
    since: Instant
  ): Promise<LegalCheckCount> {
    return LegalCheckCount.parse(
      await this.prisma.pollLegalCheckLog.count({
        where: { checkedBy, checkedAt: { gte: Instant.toDate(since) } },
      })
    );
  }
  async sumDailyTokens(
    checkedBy: UserId,
    dayStart: Instant
  ): Promise<TokenCount> {
    const result = await this.prisma.pollLegalCheckLog.aggregate({
      where: { checkedBy, checkedAt: { gte: Instant.toDate(dayStart) } },
      _sum: { inputTokens: true, outputTokens: true },
    });

    return TokenCount.parse(
      (result._sum.inputTokens ?? 0) + (result._sum.outputTokens ?? 0)
    );
  }
}
