import { success, failure, type Result } from '@/domain/shared/Result';
import { LegalCheckDomainCodes } from './LegalCheckDomainCodes';
import type {
  LegalAnnotation,
  LegalAnalysisSummary,
} from '@/application/ai/legalAnalysisSchema';

export interface LegalCheckProps {
  id: string;
  pollId: string;
  model: string;
  annotations: LegalAnnotation[];
  summary: LegalAnalysisSummary;
  overallRisk: 'low' | 'medium' | 'high';
  totalIssues: number;
  checkedBy: string;
  checkedAt: Date;
}

export interface CreateLegalCheckInput {
  pollId: string;
  model: string;
  annotations: LegalAnnotation[];
  summary: LegalAnalysisSummary;
  checkedBy: string;
}

export class LegalCheck {
  private constructor(private props: LegalCheckProps) {}

  public static create(
    input: CreateLegalCheckInput
  ): Result<LegalCheck, string> {
    if (!input.pollId || input.pollId.trim().length === 0) {
      return failure(LegalCheckDomainCodes.POLL_NOT_FOUND);
    }

    if (!input.checkedBy || input.checkedBy.trim().length === 0) {
      return failure('domain.legalCheck.checkedByRequired');
    }

    return success(
      new LegalCheck({
        id: '',
        pollId: input.pollId,
        model: input.model,
        annotations: input.annotations,
        summary: input.summary,
        overallRisk: input.summary.overallRisk,
        totalIssues: input.summary.totalIssues,
        checkedBy: input.checkedBy,
        checkedAt: new Date(),
      })
    );
  }

  public static reconstitute(props: LegalCheckProps): LegalCheck {
    return new LegalCheck(props);
  }

  get id(): string {
    return this.props.id;
  }
  get pollId(): string {
    return this.props.pollId;
  }
  get model(): string {
    return this.props.model;
  }
  get annotations(): LegalAnnotation[] {
    return this.props.annotations;
  }
  get summary(): LegalAnalysisSummary {
    return this.props.summary;
  }
  get overallRisk(): 'low' | 'medium' | 'high' {
    return this.props.overallRisk;
  }
  get totalIssues(): number {
    return this.props.totalIssues;
  }
  get checkedBy(): string {
    return this.props.checkedBy;
  }
  get checkedAt(): Date {
    return this.props.checkedAt;
  }

  public toJSON(): LegalCheckProps {
    return { ...this.props };
  }
}
