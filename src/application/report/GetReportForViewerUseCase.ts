import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportAttachmentMetadata } from '../../domain/report/ReportAttachmentRepository';
import { Poll } from '../../domain/poll/Poll';
import { ResolveReportVisibilityService } from './ResolveReportVisibilityService';
import { ReportErrors } from './ReportErrors';

export interface AttachmentRepoForGetReport {
  findByReportId(
    reportId: string
  ): Promise<Result<ReportAttachmentMetadata[], string>>;
}

export interface PollRepoForGetReport {
  getPollById(id: string): Promise<Result<Poll | null, string>>;
}

export interface GetReportForViewerResult {
  report: Report;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }>;
  polls: Array<{
    id: string;
    title: string;
    state: string;
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
  }): Promise<Result<GetReportForViewerResult, string>> {
    const reportResult = await this.reports.findByIdWithRelations(
      input.reportId
    );

    if (!reportResult.success) {
      return failure(reportResult.error);
    }

    if (!reportResult.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = reportResult.value;

    const canRead = await this.visibility.canRead(report, input.viewerId);

    // Collapse forbidden → not-found to avoid leaking existence
    if (!canRead) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const attachmentsResult = await this.attachments.findByReportId(
      input.reportId
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

    const pollSummaries: Array<{
      id: string;
      title: string;
      state: string;
      archivedAt: Date | null;
    }> = [];

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
        state: String(poll.state),
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
