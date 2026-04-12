import type { PrismaClient } from '@/generated/prisma/client';
import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';
import { LegalCheck } from '@/domain/ai/LegalCheck';
import type {
  LegalAnnotation,
  LegalAnalysisSummary,
} from '@/application/ai/legalAnalysisSchema';

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
        pollId: legalCheck.pollId,
        ...data,
      },
      update: data,
    });

    return LegalCheck.reconstitute({
      id: saved.id,
      pollId: saved.pollId,
      model: saved.model,
      annotations: saved.annotations as unknown as LegalAnnotation[],
      summary: saved.summary as unknown as LegalAnalysisSummary,
      overallRisk: saved.overallRisk,
      totalIssues: saved.totalIssues,
      checkedBy: saved.checkedBy,
      checkedAt: saved.checkedAt,
    });
  }

  async findByPollId(
    pollId: string
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
        annotations: found.annotations as unknown as LegalAnnotation[],
        summary: found.summary as unknown as LegalAnalysisSummary,
        overallRisk: found.overallRisk,
        totalIssues: found.totalIssues,
        checkedBy: found.checkedBy,
        checkedAt: found.checkedAt,
      }),
      isStale: found.isStale,
    };
  }

  async markStale(pollId: string): Promise<void> {
    await this.prisma.pollLegalCheck.updateMany({
      where: { pollId },
      data: { isStale: true },
    });
  }

  async logCheckAttempt(
    pollId: string,
    checkedBy: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    await this.prisma.pollLegalCheckLog.create({
      data: { pollId, checkedBy, inputTokens, outputTokens },
    });
  }

  async countRecentChecks(
    checkedBy: string,
    windowMs: number
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);

    return this.prisma.pollLegalCheckLog.count({
      where: {
        checkedBy,
        checkedAt: { gte: since },
      },
    });
  }

  async sumDailyTokens(checkedBy: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await this.prisma.pollLegalCheckLog.aggregate({
      where: {
        checkedBy,
        checkedAt: { gte: startOfDay },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
    });

    return (result._sum.inputTokens ?? 0) + (result._sum.outputTokens ?? 0);
  }
}
