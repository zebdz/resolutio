/** A validated analysis snapshot with caller-provided identity and checking time.
 * Summary-derived values have one source; JSON/ORM inputs cannot bypass validation. */
import { success, failure, type Result } from '@/domain/shared/Result';
import {
  LegalCheckDomainCodes,
  LegalCheckDomainCode,
} from './LegalCheckDomainCodes';
import { LegalCheckId, PollId, UserId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { EntityCreation } from '../shared/EntityCreation';
import {
  AIModelKey,
  LegalIssueCount,
  LegalAnnotation,
  LegalAnalysisSummary,
  legalAnalysisResultSchema,
} from './LegalAnalysis';

export interface RawLegalCheckProps {
  id: string;
  pollId: string;
  model: string;
  annotations: unknown;
  summary: unknown;
  overallRisk: string;
  totalIssues: number;
  checkedBy: string;
  checkedAt: Date;
}
export interface LegalCheckProps {
  readonly id: LegalCheckId;
  readonly pollId: PollId;
  readonly model: AIModelKey;
  readonly annotations: LegalAnnotation[];
  readonly summary: LegalAnalysisSummary;
  readonly checkedBy: UserId;
  readonly checkedAt: Instant;
}
export interface CreateLegalCheckInput {
  readonly pollId: PollId;
  readonly model: AIModelKey;
  readonly annotations: LegalAnnotation[];
  readonly summary: LegalAnalysisSummary;
  readonly checkedBy: UserId;
}

export class LegalCheck {
  private constructor(private readonly props: LegalCheckProps) {}

  public static create(
    input: CreateLegalCheckInput,
    creation: EntityCreation<LegalCheckId>
  ): Result<LegalCheck, LegalCheckDomainCode> {
    const pollId = PollId.safeParse(input.pollId);

    if (!pollId.success) {
      return failure(LegalCheckDomainCodes.POLL_NOT_FOUND);
    }

    const checkedBy = UserId.safeParse(input.checkedBy);

    if (!checkedBy.success) {
      return failure(LegalCheckDomainCodes.CHECKED_BY_REQUIRED);
    }

    try {
      const analysis = legalAnalysisResultSchema.parse(input);

      return success(
        new LegalCheck({
          id: LegalCheckId.parse(creation.id),
          pollId: pollId.data,
          model: AIModelKey.parse(input.model),
          ...analysis,
          checkedBy: checkedBy.data,
          checkedAt: Instant.parse(creation.now),
        })
      );
    } catch {
      return failure(LegalCheckDomainCodes.INVALID_DATA);
    }
  }

  public static reconstitute(data: RawLegalCheckProps): LegalCheck {
    const analysis = legalAnalysisResultSchema.parse(data);

    if (
      data.overallRisk !== analysis.summary.overallRisk ||
      data.totalIssues !== analysis.summary.totalIssues
    ) {
      throw new Error(LegalCheckDomainCodes.INVALID_DATA);
    }

    return new LegalCheck({
      id: LegalCheckId.parse(data.id),
      pollId: PollId.parse(data.pollId),
      model: AIModelKey.parse(data.model),
      ...analysis,
      checkedBy: UserId.parse(data.checkedBy),
      checkedAt: Instant.fromDate(data.checkedAt),
    });
  }

  get id(): LegalCheckId {
    return this.props.id;
  }
  get pollId(): PollId {
    return this.props.pollId;
  }
  get model(): AIModelKey {
    return this.props.model;
  }
  get annotations(): LegalAnnotation[] {
    return this.props.annotations.map((item) => ({ ...item }));
  }
  get summary(): LegalAnalysisSummary {
    return { ...this.props.summary };
  }
  get overallRisk(): LegalAnalysisSummary['overallRisk'] {
    return this.props.summary.overallRisk;
  }
  get totalIssues(): LegalIssueCount {
    return this.props.summary.totalIssues;
  }
  get checkedBy(): UserId {
    return this.props.checkedBy;
  }
  get checkedAt(): Date {
    return Instant.toDate(this.props.checkedAt);
  }

  public toJSON() {
    return {
      id: this.id,
      pollId: this.pollId,
      model: this.model,
      annotations: this.annotations,
      summary: this.summary,
      overallRisk: this.overallRisk,
      totalIssues: this.totalIssues,
      checkedBy: this.checkedBy,
      checkedAt: this.checkedAt,
    };
  }
}
