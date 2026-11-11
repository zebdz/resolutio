/** Retrieves an authorized report and safe projections; bytes remain behind download ports. */
import { ReportAttachmentRepository } from '../../domain/report/ReportAttachmentRepository';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ReportUseCaseFailure } from './ReportErrors';
import { z } from 'zod';
import { ReportId, UserId, PollId } from '../../domain/shared/EntityIds';
import { PollTitle } from '../../domain/poll/PollContent';
import { PollState } from '../../domain/poll/PollState';
import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportAttachmentMetadata } from '../../domain/report/ReportAttachmentRepository';
import { Poll } from '../../domain/poll/Poll';
import { ResolveReportVisibilityService } from './ResolveReportVisibilityService';
import { ReportErrors } from './ReportErrors';

export type AttachmentRepoForGetReport = Pick<
  ReportAttachmentRepository,
  'findByReportId'
>;
export type PollRepoForGetReport = Pick<PollRepository, 'getPollById'>;

export interface GetReportForViewerResult {
  report: Report;
  attachments: Array<Omit<ReportAttachmentMetadata, 'reportId'>>;
  polls: Array<{
    id: PollId;
    title: PollTitle;
    state: PollState;
    archivedAt: Date | null;
  }>;
}

export class GetReportForViewerUseCase {
  constructor(
    private reports: ReportRepository,
    private visibility: ResolveReportVisibilityService,
    private attachments: AttachmentRepoForGetReport,
    private polls: PollRepoForGetReport
  ) {}

  async execute(input: {
    reportId: string;
    viewerId: string | null;
  }): Promise<Result<GetReportForViewerResult, ReportUseCaseFailure>> {
    const decoded = z
      .object({ reportId: ReportId, viewerId: UserId.nullable() })
      .safeParse(input);

    if (!decoded.success) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const command = decoded.data;
    const reportResult = await this.reports.findByIdWithRelations(
      command.reportId
    );

    if (!reportResult.success) {
      return failure(reportResult.error);
    }

    if (!reportResult.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = reportResult.value;

    const canRead = await this.visibility.canRead(report, command.viewerId);

    // Collapse forbidden → not-found to avoid leaking existence
    if (!canRead) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const attachmentsResult = await this.attachments.findByReportId(
      command.reportId
    );

    if (!attachmentsResult.success) {
      return failure(attachmentsResult.error);
    }

    const attachmentMetadata = attachmentsResult.value.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt,
    }));

    const pollSummaries: GetReportForViewerResult['polls'] = [];

    for (const pollId of report.pollIds) {
      const pollResult = await this.polls.getPollById(pollId);

      if (!pollResult.success) {
        continue;
      }

      const poll = pollResult.value;

      if (!poll) {
        continue;
      }

      pollSummaries.push({
        id: poll.id,
        title: poll.title,
        state: poll.state,
        archivedAt: poll.archivedAt,
      });
    }

    return success({
      report,
      attachments: attachmentMetadata,
      polls: pollSummaries,
    });
  }
}
